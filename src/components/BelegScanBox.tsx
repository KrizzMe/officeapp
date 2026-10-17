import { useRef, type ChangeEvent } from 'react'
import type { BelegScanState } from '../hooks/useBelegScan'
import { isBelegScanConfigured } from '../lib/belegScan'

interface Props {
  scan: BelegScanState
  /** Wird mit der gewählten Datei aufgerufen; der Aufrufer startet scan.scanFile() und füllt das Formular. */
  onFile: (file: File) => void
  /** Zusatzhinweis nach dem Auslesen (z. B. „sieht eher nach Werbungskosten aus“). */
  hint?: string | null
}

/**
 * Beleg fotografieren oder hochladen (Issue #79). Die Kamera-Schaltfläche öffnet auf dem Handy
 * direkt die Kamera-App (`capture`), „Datei wählen“ nimmt ein vorhandenes Foto/Bild (Desktop).
 */
export function BelegScanBox({ scan, onFile, hint }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isBelegScanConfigured && !scan.oneDriveConfigured) return null

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div className="beleg-scan beleg-form-wide">
      <div className="beleg-scan-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={scan.scanning}
          onClick={() => cameraRef.current?.click()}
        >
          📷 Beleg fotografieren
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={scan.scanning}
          onClick={() => fileRef.current?.click()}
        >
          Datei wählen
        </button>
        {scan.pending && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={scan.scanning} onClick={scan.clear}>
            Foto entfernen
          </button>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleChange} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleChange} />
      </div>

      {scan.pending && (
        <img className="beleg-scan-preview" src={scan.pending.previewUrl} alt="Vorschau des Belegs" />
      )}

      {scan.scanning && <p className="form-hint" role="status">Beleg wird gelesen … (kann bis zu einer Minute dauern)</p>}
      {scan.scanError && <p className="form-error">{scan.scanError}</p>}
      {hint && <p className="form-hint">{hint}</p>}

      {scan.pending && !scan.scanning && !scan.scanError && (
        <p className="form-hint">
          Bitte die vorausgefüllten Werte prüfen. Das Foto wird beim Speichern in OneDrive abgelegt.
        </p>
      )}

      {scan.oneDriveConfigured && !scan.oneDriveConnected && (
        <p className="form-hint">
          OneDrive ist noch nicht verbunden.{' '}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void scan.connect()}>
            Mit OneDrive verbinden
          </button>
        </p>
      )}
    </div>
  )
}
