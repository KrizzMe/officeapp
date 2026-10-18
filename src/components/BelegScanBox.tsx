import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { BelegScanState } from '../hooks/useBelegScan'
import { isBelegScanConfigured } from '../lib/belegScan'

interface Props {
  scan: BelegScanState
  /** Gewählte Dateien: der Aufrufer ruft scan.addFiles() auf und füllt bei einem Ergebnis das Formular. */
  onFiles: (files: File[]) => void
  /** Gesammelte Fotos auslesen: der Aufrufer ruft scan.scanPhotos() auf und füllt das Formular. */
  onScanPhotos: () => void
  /** Zusatzhinweis nach dem Auslesen (z. B. „sieht eher nach Werbungskosten aus“). */
  hint?: string | null
}

/**
 * Beleg fotografieren oder hochladen (Issue #79). „Beleg fotografieren“ öffnet auf dem Handy direkt
 * die Kamera-App (`capture`) und lässt sich für weitere Seiten wiederholen; „Datei wählen“ nimmt
 * ein oder mehrere Bilder oder ein PDF. Ein Klick auf eine Vorschau öffnet sie groß.
 */
export function BelegScanBox({ scan, onFiles, onScanPhotos, hint }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const zoomRef = useRef<HTMLDialogElement>(null)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  useEffect(() => {
    const dialog = zoomRef.current
    if (zoomUrl && dialog && !dialog.open) dialog.showModal()
  }, [zoomUrl])

  if (!isBelegScanConfigured && !scan.oneDriveConfigured) return null

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) onFiles(files)
  }

  const photoCount = scan.photos.length

  return (
    <div className="beleg-scan beleg-form-wide">
      <div className="beleg-scan-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={scan.scanning}
          onClick={() => cameraRef.current?.click()}
        >
          📷 {photoCount > 0 ? 'Weitere Seite fotografieren' : 'Beleg fotografieren'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={scan.scanning}
          onClick={() => fileRef.current?.click()}
        >
          Datei wählen (Bild/PDF)
        </button>
        {photoCount > 0 && (
          <button type="button" className="btn btn-primary btn-sm" disabled={scan.scanning} onClick={onScanPhotos}>
            Beleg auslesen ({photoCount} {photoCount === 1 ? 'Seite' : 'Seiten'})
          </button>
        )}
        {scan.pending && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={scan.scanning} onClick={scan.clear}>
            Beleg entfernen
          </button>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleChange} />
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={handleChange} />
      </div>

      {(photoCount > 0 || scan.pdf) && (
        <div className="beleg-scan-thumbs">
          {scan.photos.map((photo, index) => (
            <div key={photo.previewUrl} className="beleg-scan-thumb">
              <button
                type="button"
                className="beleg-scan-preview-button"
                onClick={() => setZoomUrl(photo.previewUrl)}
                aria-label={`Seite ${index + 1} vergrößern`}
                title="Zum Vergrößern klicken"
              >
                <img className="beleg-scan-preview" src={photo.previewUrl} alt={`Seite ${index + 1} des Belegs`} />
              </button>
              <span className="stat-sub">Seite {index + 1}</span>
              <button
                type="button"
                className="beleg-scan-thumb-remove"
                disabled={scan.scanning}
                onClick={() => scan.removePhoto(index)}
                aria-label={`Seite ${index + 1} entfernen`}
                title="Seite entfernen"
              >
                ✕
              </button>
            </div>
          ))}
          {scan.pdf?.previewUrls.map((url, index) => (
            <div key={url} className="beleg-scan-thumb">
              <button
                type="button"
                className="beleg-scan-preview-button"
                onClick={() => setZoomUrl(url)}
                aria-label={`PDF-Seite ${index + 1} vergrößern`}
                title="Zum Vergrößern klicken"
              >
                <img className="beleg-scan-preview" src={url} alt={`PDF-Seite ${index + 1}`} />
              </button>
              <span className="stat-sub">
                Seite {index + 1} von {scan.pdf!.pageCount}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Esc oder ein Klick irgendwohin schließt die große Ansicht. */}
      <dialog ref={zoomRef} className="beleg-scan-zoom" onClick={() => zoomRef.current?.close()} onClose={() => setZoomUrl(null)}>
        {zoomUrl && <img src={zoomUrl} alt="Beleg, große Ansicht" />}
      </dialog>

      {scan.scanning && <p className="form-hint" role="status">Beleg wird verarbeitet … (kann bis zu einer Minute dauern)</p>}
      {scan.scanError && <p className="form-error">{scan.scanError}</p>}
      {scan.notice && <p className="form-hint">{scan.notice}</p>}
      {hint && <p className="form-hint">{hint}</p>}

      {photoCount > 0 && !scan.scanning && (
        <p className="form-hint">
          Alle Seiten des Belegs aufnehmen, dann „Beleg auslesen“ wählen.
          {photoCount > 1 && ' Mehrere Seiten werden als ein PDF in OneDrive abgelegt.'}
        </p>
      )}
      {scan.pdf && !scan.scanning && !scan.scanError && (
        <p className="form-hint">
          Bitte die vorausgefüllten Werte prüfen. Das PDF wird beim Speichern in OneDrive abgelegt.
          {scan.pdf.previewUrls.length < scan.pdf.pageCount &&
            ` Gezeigt werden die ersten ${scan.pdf.previewUrls.length} von ${scan.pdf.pageCount} Seiten.`}
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
