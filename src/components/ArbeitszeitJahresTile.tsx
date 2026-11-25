import { useState, type FormEvent } from 'react'
import type { ArbeitszeitKonto } from '../hooks/useArbeitszeitKonto'
import { setArbeitszeitUebertrag } from '../firebase/firestore'
import { formatDauer, formatSaldo, parseSaldo } from '../lib/arbeitszeit'
import { ArbeitszeitSaldoTile } from './ArbeitszeitSaldoTile'

interface Props {
  uid: string
  year: number
  konto: ArbeitszeitKonto
  onUpdated: () => void
}

/**
 * Überstunden-Saldo eines Jahres in der Jahresübersicht (Issue #83) mit
 * manuell überschreibbarem Übertrag aus dem Vorjahr (analog Resturlaub, #74).
 */
export function ArbeitszeitJahresTile({ uid, year, konto, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setValue(formatSaldo(konto.uebertrag.minuten).replace('±', ''))
    setError(null)
    setEditing(true)
  }

  const save = async (minuten: number | null) => {
    setSaving(true)
    setError(null)
    try {
      await setArbeitszeitUebertrag(uid, year, minuten)
      setEditing(false)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const minuten = parseSaldo(value)
    if (minuten === null) {
      setError('Bitte als Stunden:Minuten angeben, z. B. +12:30 oder -3:15.')
      return
    }
    void save(minuten)
  }

  return (
    <ArbeitszeitSaldoTile label={`Überstunden-Saldo ${year}`} saldoMin={konto.ctx ? konto.gesamtSaldoMin : null}>
      <span className="stat-sub">
        Ist {formatDauer(konto.jahr.istMin)} h von Soll {formatDauer(konto.jahr.sollMin)} h
        {konto.jahr.fehlendeTage > 0 && (
          <span className="stat-sub--warning">
            {' '}· {konto.jahr.fehlendeTage} {konto.jahr.fehlendeTage === 1 ? 'Tag' : 'Tage'} ohne Zeiten
          </span>
        )}
      </span>
      {editing ? (
        <form onSubmit={handleSubmit} className="uebertrag-form">
          <label className="stat-sub" htmlFor={`uebertrag-${year}`}>
            Übertrag aus {year - 1} (Std:Min)
          </label>
          <div className="form-row">
            <input
              id={`uebertrag-${year}`}
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="+12:30"
              autoFocus
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              Speichern
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setEditing(false)}>
              Abbrechen
            </button>
          </div>
          {konto.uebertrag.manuell && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => void save(null)}>
              Automatisch berechnen
            </button>
          )}
          {error && <p className="form-error">{error}</p>}
        </form>
      ) : (
        <span className="stat-sub">
          Übertrag aus {year - 1}: {formatSaldo(konto.uebertrag.minuten)} h ({konto.uebertrag.manuell ? 'manuell' : 'automatisch'}){' '}
          <button type="button" className="link-button" onClick={startEdit}>
            ändern
          </button>
        </span>
      )}
    </ArbeitszeitSaldoTile>
  )
}
