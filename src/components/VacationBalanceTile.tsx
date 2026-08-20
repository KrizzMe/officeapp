import type { CSSProperties } from 'react'
import type { VacationBalance, VacationType } from '../types/models'
import { statusVisual, vacationTypeColor } from '../lib/statusColors'

interface Props {
  balance: VacationBalance
  vacationType: VacationType
  /** Jahr, auf das sich `usedDays`/`totalDays` beziehen, für den Hinweistext. */
  year: number
}

/** Kachel für den Saldo einer Urlaubsart, gemeinsam genutzt von MonthStats und YearOverview. */
export function VacationBalanceTile({ balance, vacationType, year }: Props) {
  const ratio = balance.totalDays > 0 ? Math.min(100, (balance.usedDays / balance.totalDays) * 100) : 0
  const hatched = statusVisual(balance.vacationTypeId).hatched
  const fillClass = hatched ? 'progress-fill progress-fill--hatched' : 'progress-fill'
  const fillStyle: CSSProperties = hatched
    ? { width: `${ratio}%` }
    : { width: `${ratio}%`, background: vacationTypeColor(vacationType) }

  return (
    <div className="card stat-tile">
      <span className="stat-label">{vacationType.name}</span>
      <span className="stat-value">{balance.remainingDays}</span>
      <div className="progress-track">
        <div className={fillClass} style={fillStyle} />
      </div>
      <span className="stat-sub">
        {balance.usedDays} von {balance.totalDays} genommen in {year}
      </span>
    </div>
  )
}
