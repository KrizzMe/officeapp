import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { UserProfile } from '../types/models'
import { updateUserProfile } from '../firebase/firestore'
import {
  DEFAULT_ORDNER_HANDWERKER,
  DEFAULT_ORDNER_WERBUNGSKOSTEN,
  normalizePfad,
} from '../lib/belegOrdner'
import {
  connectOneDrive,
  disconnectOneDrive,
  getOneDriveAccountName,
  isOneDriveConfigured,
  isOneDriveConnected,
} from '../lib/onedrive'

interface Props {
  profile: UserProfile
  onUpdated: () => void
}

/**
 * Einstellung der OneDrive-Ablage für Belege (Issue #79): Stamm-Pfad und Ordnernamen. Ohne Stamm-Pfad
 * landen die Belege im App-Ordner `Apps/<App-Name>` (enge Rechte); mit Stamm-Pfad braucht die App den
 * Zugriff auf das gesamte OneDrive und fragt beim nächsten Upload einmal nach der Zustimmung.
 */
export function BelegAblageEditor({ profile, onUpdated }: Props) {
  const gespeicherterPfad = normalizePfad(profile.belegBasisPfad)
  // undefined = wird noch geprüft
  const [konto, setKonto] = useState<string | null | undefined>(undefined)
  const [rechteOk, setRechteOk] = useState(false)
  const [verbindungBusy, setVerbindungBusy] = useState(false)
  const [verbindungError, setVerbindungError] = useState<string | null>(null)

  /** Liest Konto und Rechte (für den gespeicherten Stamm-Pfad) neu ein. */
  const refreshVerbindung = useCallback(async () => {
    try {
      const [name, ok] = await Promise.all([getOneDriveAccountName(), isOneDriveConnected(gespeicherterPfad)])
      setKonto(name)
      setRechteOk(ok)
    } catch {
      setKonto(null)
      setRechteOk(false)
    }
  }, [gespeicherterPfad])

  useEffect(() => {
    void refreshVerbindung()
  }, [refreshVerbindung])

  const handleVerbinden = async () => {
    setVerbindungBusy(true)
    setVerbindungError(null)
    try {
      await connectOneDrive(gespeicherterPfad)
    } catch (err) {
      setVerbindungError(err instanceof Error ? err.message : String(err))
    } finally {
      await refreshVerbindung()
      setVerbindungBusy(false)
    }
  }

  const handleTrennen = async () => {
    if (!window.confirm('OneDrive in dieser App trennen? Bereits abgelegte Belege in OneDrive bleiben unberührt.')) return
    setVerbindungBusy(true)
    setVerbindungError(null)
    try {
      await disconnectOneDrive()
    } catch (err) {
      setVerbindungError(err instanceof Error ? err.message : String(err))
    } finally {
      await refreshVerbindung()
      setVerbindungBusy(false)
    }
  }

  const [basis, setBasis] = useState(profile.belegBasisPfad ?? '')
  const [handwerker, setHandwerker] = useState(profile.belegOrdnerHandwerker ?? '')
  const [werbung, setWerbung] = useState(profile.belegOrdnerWerbungskosten ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOneDriveConfigured) return null

  const basisNorm = normalizePfad(basis)
  const jahr = String(new Date().getFullYear())
  const vorschau = (ordner: string, standard: string) =>
    `${basisNorm ? `…/${basisNorm}` : 'OneDrive/Apps/<App-Name>'}/${jahr}/${normalizePfad(ordner) || standard}`

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      // Leere Felder wieder entfernen (Standard), statt leere Strings zu speichern. Teilupdate, damit
      // andere Profilsektionen unberührt bleiben (siehe updateUserProfile).
      const patch: Record<string, unknown> = {
        belegBasisPfad: basisNorm || null,
        belegOrdnerHandwerker: normalizePfad(handwerker) || null,
        belegOrdnerWerbungskosten: normalizePfad(werbung) || null,
      }
      await updateUserProfile(profile.uid, patch as Partial<UserProfile>)
      setBasis(basisNorm)
      setHandwerker(normalizePfad(handwerker))
      setWerbung(normalizePfad(werbung))
      setSaved(true)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card form-card--wide" style={{ marginBottom: 'var(--space-5)' }}>
      <h3 style={{ marginTop: 0 }}>Beleg-Ablage (OneDrive)</h3>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Belege werden unter <code>&lt;Stamm-Pfad&gt;/&lt;Jahr&gt;/&lt;Ordner&gt;</code> abgelegt. Ohne Stamm-Pfad
        landen sie im App-Ordner von OneDrive.
      </p>
      <div className="beleg-verbindung">
        <strong>Verbindung:</strong>{' '}
        {konto === undefined ? (
          <span>wird geprüft …</span>
        ) : konto === null ? (
          <span>Nicht verbunden</span>
        ) : rechteOk ? (
          <span>Verbunden als {konto}</span>
        ) : (
          <span>Verbunden als {konto} — für den gespeicherten Stamm-Pfad fehlen noch Rechte, bitte neu verbinden</span>
        )}
        <div className="inline-form-actions" style={{ marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn btn-primary btn-sm" disabled={verbindungBusy} onClick={() => void handleVerbinden()}>
            {konto === null || konto === undefined ? 'Mit OneDrive verbinden' : 'Neu verbinden'}
          </button>
          {konto && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={verbindungBusy} onClick={() => void handleTrennen()}>
              Trennen
            </button>
          )}
        </div>
        {verbindungError && <p className="form-error">{verbindungError}</p>}
      </div>

      <form onSubmit={handleSubmit} className="beleg-form">
        <label className="field beleg-form-wide">
          <span>Stamm-Pfad in OneDrive (leer = App-Ordner)</span>
          <input
            className="input"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder="z. B. 01_Allgemeine_Unterlagen\Steuern"
          />
        </label>
        <label className="field">
          <span>Ordner Handwerkerleistungen</span>
          <input
            className="input"
            value={handwerker}
            onChange={(e) => setHandwerker(e.target.value)}
            placeholder={DEFAULT_ORDNER_HANDWERKER}
          />
        </label>
        <label className="field">
          <span>Ordner Werbungskosten</span>
          <input
            className="input"
            value={werbung}
            onChange={(e) => setWerbung(e.target.value)}
            placeholder={DEFAULT_ORDNER_WERBUNGSKOSTEN}
          />
        </label>
        <p className="form-hint beleg-form-wide" style={{ marginTop: 0 }}>
          Beispiel Handwerker: <code>{vorschau(handwerker, DEFAULT_ORDNER_HANDWERKER)}</code>
          <br />
          Beispiel Werbungskosten: <code>{vorschau(werbung, DEFAULT_ORDNER_WERBUNGSKOSTEN)}</code>
        </p>
        {basisNorm && (
          <p className="form-hint beleg-form-wide" style={{ marginTop: 0 }}>
            Für einen eigenen Stamm-Pfad braucht die App Zugriff auf dein gesamtes OneDrive (sie schreibt aber
            nur in diesen Pfad). Nach dem Speichern oben „Neu verbinden“ wählen, dann fragt Microsoft einmal danach.
          </p>
        )}
        {error && <p className="form-error beleg-form-wide">{error}</p>}
        {saved && <p className="form-hint beleg-form-wide">Gespeichert.</p>}
        <div className="inline-form-actions beleg-form-wide">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            Speichern
          </button>
        </div>
      </form>
    </div>
  )
}
