import type { ReactNode } from 'react'
import { formatSaldo } from '../lib/arbeitszeit'

interface Props {
  label: string
  /** `null`, solange im Profil keine Wochenstunden hinterlegt sind. */
  saldoMin: number | null
  /** Zusätzliche Zeilen unter dem Wert (z. B. Ist/Soll, Übertrag). */
  children?: ReactNode
}

/** Kachel für ein Überstunden-Saldo (Issue #83), gemeinsam genutzt von Dashboard, Monats- und Jahresübersicht. */
export function ArbeitszeitSaldoTile({ label, saldoMin, children }: Props) {
  return (
    <div className="card stat-tile">
      <span className="stat-label">{label}</span>
      {saldoMin === null ? (
        <span className="stat-sub">Wochenarbeitszeit im Profil eintragen, um das Saldo zu berechnen.</span>
      ) : (
        <>
          <span className={`stat-value ${saldoMin >= 0 ? 'is-positive' : 'is-negative'}`}>{formatSaldo(saldoMin)} h</span>
          {children}
        </>
      )}
    </div>
  )
}
