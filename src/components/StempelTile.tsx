import { useEffect, useState } from 'react'
import type { DayEntry } from '../types/models'
import { setDayArbeitszeit } from '../firebase/firestore'
import { parseIsoDate, toIsoDate } from '../lib/dates'
import {
  arbeitszeitOf,
  berechneNetto,
  formatDauer,
  formatUhrzeit,
  hatOffenenBlock,
  minutenSeitMitternacht,
  parseUhrzeit,
  stempelBeginnMin,
  stempelEndeMin,
  type Arbeitszeit,
} from '../lib/arbeitszeit'

interface Props {
  uid: string
  /** Heutiger Tageseintrag (falls vorhanden). */
  entry: DayEntry | undefined
  /** Berechneter Default-Status von heute (für das Speichern ohne expliziten Status). */
  defaultStatus: string
  /** Vergangene Tage mit offenem Block (Ende vergessen), ISO-Daten. */
  offeneTage: string[]
}

/**
 * Stempeln auf dem Dashboard (Issue #83, CR): „Beginn“ und „Ende“ im Wechsel
 * mit der aktuellen, gerundeten Uhrzeit; jeder Durchgang ergibt einen
 * Arbeitsblock. Zeigt live die Arbeitszeit des Tages und den Beginn des ersten
 * Blocks (ohne Saldo/Feierabend-Prognose, Issue #89).
 */
export function StempelTile({ uid, entry, defaultStatus, offeneTage }: Props) {
  const [jetzt, setJetzt] = useState(() => new Date())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setJetzt(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const todayIso = toIsoDate(jetzt)
  const zeit = arbeitszeitOf(entry)
  const laeuft = hatOffenenBlock(zeit)
  const netto = zeit ? berechneNetto(zeit, minutenSeitMitternacht(jetzt)) : null
  const ersterBlock = zeit?.bloecke[0]
  const letzterBlock = zeit?.bloecke[zeit.bloecke.length - 1]

  const speichern = async (neu: Arbeitszeit) => {
    setSaving(true)
    setError(null)
    try {
      await setDayArbeitszeit(uid, todayIso, neu, defaultStatus, entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const beginn = () => {
    const now = new Date()
    const bloecke = zeit?.bloecke ?? []
    // Ein neuer Block darf nicht vor dem (aufgerundeten) Ende des vorherigen beginnen.
    const vorherEnde = parseUhrzeit(bloecke[bloecke.length - 1]?.ende) ?? 0
    const beginnMin = Math.max(stempelBeginnMin(now), vorherEnde)
    void speichern({ bloecke: [...bloecke, { beginn: formatUhrzeit(beginnMin) }], pauseMin: zeit?.pauseMin })
  }

  const ende = () => {
    if (!zeit || !letzterBlock) return
    const now = new Date()
    const beginnMin = parseUhrzeit(letzterBlock.beginn) ?? 0
    const endeMin = Math.max(stempelEndeMin(now), beginnMin + 1)
    const bloecke = [...zeit.bloecke.slice(0, -1), { beginn: letzterBlock.beginn, ende: formatUhrzeit(endeMin) }]
    void speichern({ bloecke, pauseMin: zeit.pauseMin })
  }

  return (
    <div className="card stat-tile stempel-tile">
      <span className="stat-label">Arbeitszeit heute</span>
      <span className="stat-value stempel-value">{formatDauer(netto?.nettoMin ?? 0)} h</span>

      <span className="stat-sub">
        {ersterBlock?.beginn ? `Beginn: ${ersterBlock.beginn} Uhr` : 'Noch nicht gestempelt'}
      </span>

      {!laeuft && letzterBlock?.ende && <span className="stat-sub">Unterbrochen seit {letzterBlock.ende} Uhr</span>}

      {offeneTage.length > 0 && (
        <span className="stat-sub stat-sub--warning">
          Ende fehlt am{' '}
          {offeneTage.map((iso) => parseIsoDate(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })).join(', ')} –
          bitte in der Monatsübersicht nachtragen
        </span>
      )}

      <div className="stempel-actions">
        {laeuft ? (
          <button type="button" className="btn btn-danger" disabled={saving} onClick={ende}>
            ■ Ende
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={saving} onClick={beginn}>
            ▶ Beginn
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
