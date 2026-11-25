import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ArbeitsBlock, DayEntry } from '../types/models'
import {
  arbeitszeitOf,
  berechneNetto,
  formatDauer,
  formatSaldo,
  minutenSeitMitternacht,
  pruefeBloecke,
  sortiereBloecke,
  type Arbeitszeit,
} from '../lib/arbeitszeit'
import { toIsoDate } from '../lib/dates'

interface Props {
  date: Date
  entry: DayEntry | undefined
  /** Soll je Arbeitstag in Minuten, `null` ohne Wochenstunden im Profil. */
  sollMin: number | null
  onSave: (zeit: Arbeitszeit | null) => Promise<void>
  onClose: () => void
}

const LEERER_BLOCK: ArbeitsBlock = { beginn: '', ende: '' }

/**
 * Eingabe der Arbeitsblöcke eines Tages (Issue #83) als modaler Dialog aus
 * der Monatsübersicht, z. B. 08:00–14:00 und 16:00–18:00. Zeigt live die
 * Netto-Arbeitszeit inkl. der gesetzlichen Mindestpause. Am heutigen Tag
 * darf der letzte Block offen bleiben (läuft noch, vgl. Stempeln im Dashboard).
 */
export function ArbeitszeitDialog({ date, entry, sollMin, onSave, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const vorhanden = arbeitszeitOf(entry)
  const [bloecke, setBloecke] = useState<ArbeitsBlock[]>(
    vorhanden ? vorhanden.bloecke.map((b) => ({ beginn: b.beginn, ende: b.ende ?? '' })) : [{ ...LEERER_BLOCK }],
  )
  const [pause, setPause] = useState(vorhanden?.pauseMin ? String(vorhanden.pauseMin) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const istHeute = toIsoDate(date) === toIsoDate(new Date())

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const pauseMin = pause.trim() === '' ? undefined : Math.max(0, Math.round(Number(pause.replace(',', '.'))))
  const bereinigt: ArbeitsBlock[] = sortiereBloecke(
    bloecke
      .filter((b) => b.beginn || b.ende)
      .map((b) => (b.ende ? { beginn: b.beginn, ende: b.ende } : { beginn: b.beginn })),
  )
  const zeit: Arbeitszeit = { bloecke: bereinigt, ...(pauseMin ? { pauseMin } : {}) }
  const netto = berechneNetto(zeit, istHeute ? minutenSeitMitternacht(new Date()) : undefined)
  const laeuft = bereinigt.length > 0 && !bereinigt[bereinigt.length - 1].ende

  const updateBlock = (index: number, feld: keyof ArbeitsBlock, value: string) =>
    setBloecke((prev) => prev.map((b, i) => (i === index ? { ...b, [feld]: value } : b)))

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
    const fehler = pruefeBloecke(bereinigt, istHeute)
    if (fehler) {
      setError(fehler)
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

        <div className="zeit-bloecke">
          {bloecke.map((block, index) => (
            <div key={index} className="zeit-block-row">
              <label className="field">
                <span>Beginn</span>
                <input
                  className="input"
                  type="time"
                  value={block.beginn}
                  onChange={(e) => updateBlock(index, 'beginn', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Ende{istHeute && index === bloecke.length - 1 ? ' (leer = läuft)' : ''}</span>
                <input
                  className="input"
                  type="time"
                  value={block.ende ?? ''}
                  onChange={(e) => updateBlock(index, 'ende', e.target.value)}
                />
              </label>
              {bloecke.length > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary zeit-block-remove"
                  aria-label={`Block ${index + 1} entfernen`}
                  onClick={() => setBloecke((prev) => prev.filter((_, i) => i !== index))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setBloecke((prev) => [...prev, { ...LEERER_BLOCK }])}
          >
            + Arbeitsblock
          </button>
        </div>

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

        {netto && (
          <dl className="zeit-dialog-summary">
            <dt>Anwesenheit</dt>
            <dd>
              {formatDauer(netto.anwesendMin)} h{laeuft && <span className="zeit-dialog-hint"> (läuft)</span>}
            </dd>
            {netto.lueckenMin > 0 && (
              <>
                <dt>Unterbrechungen</dt>
                <dd>{formatDauer(netto.lueckenMin)} h</dd>
              </>
            )}
            {netto.eigenePauseMin + netto.zusatzPauseMin > 0 && (
              <>
                <dt>Pause</dt>
                <dd>
                  {formatDauer(netto.eigenePauseMin + netto.zusatzPauseMin)} h
                  {netto.gesetzlichAngewendet && <span className="zeit-dialog-hint"> (gesetzliche Mindestpause)</span>}
                </dd>
              </>
            )}
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
