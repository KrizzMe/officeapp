import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { DayEntry } from '../types/models'
import { arbeitszeitOf, berechneNetto, formatDauer, formatSaldo, type Arbeitszeit } from '../lib/arbeitszeit'

interface Props {
  date: Date
  entry: DayEntry | undefined
  /** Soll je Arbeitstag in Minuten, `null` ohne Wochenstunden im Profil. */
  sollMin: number | null
  onSave: (zeit: Arbeitszeit | null) => Promise<void>
  onClose: () => void
}

/**
 * Eingabe von Beginn/Ende/Pause eines Tages (Issue #83) als modaler Dialog
 * aus der Monatsübersicht. Zeigt live die Netto-Arbeitszeit inkl. der
 * automatisch abgezogenen gesetzlichen Mindestpause.
 */
export function ArbeitszeitDialog({ date, entry, sollMin, onSave, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const vorhanden = arbeitszeitOf(entry)
  const [beginn, setBeginn] = useState(vorhanden?.beginn ?? '')
  const [ende, setEnde] = useState(vorhanden?.ende ?? '')
  const [pause, setPause] = useState(vorhanden?.pauseMin ? String(vorhanden.pauseMin) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const pauseMin = pause.trim() === '' ? undefined : Math.max(0, Math.round(Number(pause.replace(',', '.'))))
  const zeit: Arbeitszeit = { beginn, ende, ...(pauseMin ? { pauseMin } : {}) }
  const netto = beginn && ende ? berechneNetto(zeit) : null

  const run = async (value: Arbeitszeit | null) => {
    setSaving(true)
    setError(null)
    try {
      await onSave(value)
      ref.current?.close()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (pause.trim() !== '' && (pauseMin === undefined || Number.isNaN(pauseMin))) {
      setError('Pause bitte in ganzen Minuten angeben.')
      return
    }
    if (!netto) {
      setError('Bitte Beginn und Ende angeben; das Ende muss nach dem Beginn liegen.')
      return
    }
    void run(zeit)
  }

  const titel = date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <dialog ref={ref} className="zeit-dialog" onClose={onClose} aria-labelledby="zeit-dialog-title">
      <form onSubmit={handleSubmit}>
        <h3 id="zeit-dialog-title" style={{ marginTop: 0 }}>
          Arbeitszeit {titel}
        </h3>

        <div className="zeit-dialog-fields">
          <label className="field">
            <span>Beginn</span>
            <input className="input" type="time" value={beginn} onChange={(e) => setBeginn(e.target.value)} required />
          </label>
          <label className="field">
            <span>Ende</span>
            <input className="input" type="time" value={ende} onChange={(e) => setEnde(e.target.value)} required />
          </label>
          <label className="field">
            <span>Pause (Min., optional)</span>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={pause}
              onChange={(e) => setPause(e.target.value)}
            />
          </label>
        </div>

        {netto && (
          <dl className="zeit-dialog-summary">
            <dt>Anwesenheit</dt>
            <dd>{formatDauer(netto.anwesendMin)} h</dd>
            <dt>Pause</dt>
            <dd>
              {formatDauer(netto.pauseMin)} h
              {netto.gesetzlichAngewendet && <span className="zeit-dialog-hint"> (gesetzliche Mindestpause)</span>}
            </dd>
            <dt>Arbeitszeit</dt>
            <dd>
              <strong>{formatDauer(netto.nettoMin)} h</strong>
            </dd>
            {sollMin !== null && (
              <>
                <dt>Saldo</dt>
                <dd className={netto.nettoMin - sollMin >= 0 ? 'is-positive' : 'is-negative'}>
                  {formatSaldo(netto.nettoMin - sollMin)} h
                </dd>
              </>
            )}
          </dl>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          {vorhanden && (
            <button type="button" className="btn btn-danger" disabled={saving} onClick={() => void run(null)}>
              Zeiten löschen
            </button>
          )}
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => ref.current?.close()}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
