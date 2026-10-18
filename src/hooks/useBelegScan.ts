import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { compressImage, MAX_PDF_SCAN_PAGES, MAX_SCAN_TOTAL_LENGTH, type CompressedImage } from '../lib/image'
import { isPdf, readPdf } from '../lib/pdf'
import { jpegsToPdf } from '../lib/pdfBuilder'
import { scanBeleg, type BelegScanResult, type ScanInput } from '../lib/belegScan'
import {
  connectOneDrive,
  isOneDriveConfigured,
  isOneDriveConnected,
  uploadBeleg,
  type UploadedBeleg,
} from '../lib/onedrive'

/** Ein aufgenommenes Foto (eine Seite des Belegs). */
export interface BelegPhoto extends CompressedImage {
  previewUrl: string
}

/** Ein hochgeladenes PDF; `previewUrls` zeigen die Seiten (bei sehr langen PDFs nur die ersten). */
export interface BelegPdf {
  file: File
  previewUrls: string[]
  pageCount: number
}

/** Kantenlängen, auf die Fotos für den KI-Aufruf verkleinert werden, wenn viele Seiten zusammen zu groß wären. */
const SHRINK_EDGES = [1300, 1000, 800]

/**
 * Zustand für den Beleg eines Formulars (Issue #79): ein PDF ODER mehrere Fotos (Seiten). Digitale
 * PDFs werden sofort gelesen; Fotos sammelt die App, bis der Nutzer „Beleg auslesen“ wählt. Zum
 * Speichern wandert das PDF bzw. — bei mehreren Fotos — ein daraus gebautes PDF nach OneDrive.
 */
export function useBelegScan(user: User, basePath = '') {
  const [photos, setPhotos] = useState<BelegPhoto[]>([])
  const [pdf, setPdf] = useState<BelegPdf | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [oneDriveConnected, setOneDriveConnected] = useState(false)

  // Vorschau-URLs freigeben: beim Entfernen und wenn die Komponente verschwindet.
  const urlsRef = useRef<Set<string>>(new Set())
  const track = (url: string) => {
    urlsRef.current.add(url)
    return url
  }
  const release = (url: string) => {
    URL.revokeObjectURL(url)
    urlsRef.current.delete(url)
  }
  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.clear()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    isOneDriveConnected(basePath)
      .then((connected) => {
        if (!cancelled) setOneDriveConnected(connected)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [basePath])

  const clear = useCallback(() => {
    photos.forEach((p) => release(p.previewUrl))
    if (pdf) pdf.previewUrls.forEach(release)
    setPhotos([])
    setPdf(null)
    setScanError(null)
    setNotice(null)
  }, [photos, pdf])

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const target = prev[index]
      if (target) release(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
    setNotice(null)
  }, [])

  const runScan = useCallback(
    async (input: ScanInput, kategorien: string[]): Promise<BelegScanResult | null> => {
      try {
        return await scanBeleg(user, input, kategorien)
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err))
        return null
      }
    },
    [user],
  )

  /**
   * Dateien übernehmen. Ein PDF wird sofort gelesen und das Ergebnis zurückgegeben; Bilder werden
   * als weitere Seiten gesammelt (Ergebnis null, ausgelesen wird mit scanPhotos()).
   */
  const addFiles = useCallback(
    async (files: File[], kategorien: string[] = []): Promise<BelegScanResult | null> => {
      setScanning(true)
      setScanError(null)
      setNotice(null)
      try {
        const pdfFile = files.find(isPdf)
        if (pdfFile) {
          const content = await readPdf(pdfFile)
          photos.forEach((p) => release(p.previewUrl))
          if (pdf) pdf.previewUrls.forEach(release)
          setPhotos([])
          setPdf({
            file: pdfFile,
            previewUrls: content.previews.map((p) => track(URL.createObjectURL(p.blob))),
            pageCount: content.totalPages,
          })
          const notes: string[] = []
          if (files.length > 1) notes.push('Es wurde nur das PDF übernommen, die übrigen Dateien nicht.')
          if (content.truncated) notes.push('Das PDF ist sehr lang, es wurde nicht komplett gelesen — bitte alle Werte prüfen.')
          setNotice(notes.length > 0 ? notes.join(' ') : null)
          const input: ScanInput =
            content.text !== null ? { text: content.text } : { imageDataUrls: content.pages.map((p) => p.dataUrl) }
          return await runScan(input, kategorien)
        }

        const added: BelegPhoto[] = []
        for (const file of files) {
          const image = await compressImage(file)
          added.push({ ...image, previewUrl: track(URL.createObjectURL(image.blob)) })
        }
        if (pdf) pdf.previewUrls.forEach(release)
        setPdf(null)
        const base = pdf ? [] : photos
        const room = MAX_PDF_SCAN_PAGES - base.length
        added.slice(room).forEach((p) => release(p.previewUrl))
        setPhotos([...base, ...added.slice(0, Math.max(room, 0))])
        if (added.length > room) setNotice(`Pro Beleg sind höchstens ${MAX_PDF_SCAN_PAGES} Seiten möglich.`)
        return null
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err))
        return null
      } finally {
        setScanning(false)
      }
    },
    [photos, pdf, runScan],
  )

  /** Alle gesammelten Fotos gemeinsam auslesen (Seiten werden für den Aufruf bei Bedarf verkleinert). */
  const scanPhotos = useCallback(
    async (kategorien: string[] = []): Promise<BelegScanResult | null> => {
      if (photos.length === 0) return null
      setScanning(true)
      setScanError(null)
      try {
        let urls = photos.map((p) => p.dataUrl)
        for (const edge of SHRINK_EDGES) {
          if (urls.reduce((sum, u) => sum + u.length, 0) <= MAX_SCAN_TOTAL_LENGTH) break
          urls = await Promise.all(photos.map(async (p) => (await compressImage(p.blob, edge)).dataUrl))
        }
        return await runScan({ imageDataUrls: urls }, kategorien)
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err))
        return null
      } finally {
        setScanning(false)
      }
    },
    [photos, runScan],
  )

  /** Microsoft-Konto verbinden (Popup, nur aus einem Klick heraus aufrufen). */
  const connect = useCallback(async () => {
    setScanError(null)
    try {
      await connectOneDrive(basePath)
      setOneDriveConnected(true)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err))
    }
  }, [basePath])

  /** Hochladen des Belegs (PDF, einzelnes Foto oder aus mehreren Fotos gebautes PDF); null, wenn nichts vorgemerkt ist. Wirft bei Fehlern. */
  const upload = useCallback(
    async (target: { basePath: string; folder: string }, fileName: string): Promise<UploadedBeleg | null> => {
      let blob: Blob
      if (pdf) blob = pdf.file
      else if (photos.length === 1) blob = photos[0].blob
      else if (photos.length > 1) blob = await jpegsToPdf(photos)
      else return null
      const uploaded = await uploadBeleg(blob, target, fileName)
      setOneDriveConnected(true)
      return uploaded
    },
    [pdf, photos],
  )

  /** Vorgemerkter Beleg: Dateiendung für den OneDrive-Namen; null, wenn nichts da ist. */
  const pending = pdf || photos.length > 1 ? { extension: 'pdf' as const } : photos.length === 1 ? { extension: 'jpg' as const } : null

  return {
    photos,
    pdf,
    pending,
    scanning,
    scanError,
    notice,
    oneDriveConfigured: isOneDriveConfigured,
    oneDriveConnected,
    addFiles,
    scanPhotos,
    removePhoto,
    connect,
    upload,
    clear,
  }
}

export type BelegScanState = ReturnType<typeof useBelegScan>
