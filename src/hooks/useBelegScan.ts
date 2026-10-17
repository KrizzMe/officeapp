import { useCallback, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { compressImage, type CompressedImage } from '../lib/image'
import { isPdf, readPdf } from '../lib/pdf'
import { scanBeleg, type BelegScanResult, type ScanInput } from '../lib/belegScan'
import {
  connectOneDrive,
  isOneDriveConfigured,
  isOneDriveConnected,
  uploadBeleg,
  type UploadedBeleg,
} from '../lib/onedrive'

interface Pending {
  /** Was nach OneDrive hochgeladen wird: das verkleinerte Foto bzw. das unveränderte Original-PDF. */
  blob: Blob
  /** Vorschaubild (bei PDFs die erste Seite). */
  previewUrl: string
  /** Dateiendung für den OneDrive-Dateinamen, ohne Punkt. */
  extension: 'jpg' | 'pdf'
}

/**
 * Zustand für das Beleg-Foto eines Formulars (Issue #79): Foto verkleinern, auslesen lassen,
 * bis zum Speichern im Speicher halten und dann nach OneDrive hochladen.
 */
export function useBelegScan(user: User, basePath = '') {
  const [pending, setPending] = useState<Pending | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [oneDriveConnected, setOneDriveConnected] = useState(false)

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

  // Vorschau-URL freigeben, sobald das Foto wechselt oder die Komponente verschwindet.
  useEffect(() => {
    if (!pending) return
    return () => URL.revokeObjectURL(pending.previewUrl)
  }, [pending])

  const clear = useCallback(() => {
    setPending(null)
    setScanError(null)
  }, [])

  /** Foto übernehmen und auslesen. Gibt null zurück, wenn das Auslesen fehlschlug (Foto bleibt trotzdem erhalten). */
  const scanFile = useCallback(
    async (file: File, kategorien: string[] = []): Promise<BelegScanResult | null> => {
      setScanning(true)
      setScanError(null)
      try {
        const pdf = isPdf(file)
        // Digitales PDF: Text direkt auslesen (keine Bilderkennung nötig); Scan/Foto: Bilder. Das
        // Original-PDF wandert später unverändert nach OneDrive.
        let pages: CompressedImage[]
        let input: ScanInput
        if (pdf) {
          const content = await readPdf(file)
          pages = content.pages
          input = content.text !== null ? { text: content.text } : { imageDataUrls: pages.map((p) => p.dataUrl) }
        } else {
          pages = [await compressImage(file)]
          input = { imageDataUrls: [pages[0].dataUrl] }
        }
        setPending({
          blob: pdf ? file : pages[0].blob,
          previewUrl: URL.createObjectURL(pages[0].blob),
          extension: pdf ? 'pdf' : 'jpg',
        })
        return await scanBeleg(user, input, kategorien)
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err))
        return null
      } finally {
        setScanning(false)
      }
    },
    [user],
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

  /** Hochladen des vorgemerkten Fotos; null, wenn keines vorgemerkt ist. Wirft bei Fehlern. */
  const upload = useCallback(
    async (target: { basePath: string; folder: string }, fileName: string): Promise<UploadedBeleg | null> => {
      if (!pending) return null
      const uploaded = await uploadBeleg(pending.blob, target, fileName)
      setOneDriveConnected(true)
      return uploaded
    },
    [pending],
  )

  return {
    pending,
    scanning,
    scanError,
    oneDriveConfigured: isOneDriveConfigured,
    oneDriveConnected,
    scanFile,
    connect,
    upload,
    clear,
  }
}

export type BelegScanState = ReturnType<typeof useBelegScan>
