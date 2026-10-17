import { useCallback, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { compressImage } from '../lib/image'
import { scanBeleg, type BelegScanResult } from '../lib/belegScan'
import {
  connectOneDrive,
  isOneDriveConfigured,
  isOneDriveConnected,
  uploadBeleg,
  type UploadedBeleg,
} from '../lib/onedrive'

interface Pending {
  blob: Blob
  previewUrl: string
}

/**
 * Zustand für das Beleg-Foto eines Formulars (Issue #79): Foto verkleinern, auslesen lassen,
 * bis zum Speichern im Speicher halten und dann nach OneDrive hochladen.
 */
export function useBelegScan(user: User) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [oneDriveConnected, setOneDriveConnected] = useState(false)

  useEffect(() => {
    let cancelled = false
    isOneDriveConnected()
      .then((connected) => {
        if (!cancelled) setOneDriveConnected(connected)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
        const { blob, dataUrl } = await compressImage(file)
        setPending({ blob, previewUrl: URL.createObjectURL(blob) })
        return await scanBeleg(user, dataUrl, kategorien)
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
      await connectOneDrive()
      setOneDriveConnected(true)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  /** Hochladen des vorgemerkten Fotos; null, wenn keines vorgemerkt ist. Wirft bei Fehlern. */
  const upload = useCallback(
    async (folder: string, fileName: string): Promise<UploadedBeleg | null> => {
      if (!pending) return null
      const uploaded = await uploadBeleg(pending.blob, folder, fileName)
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
