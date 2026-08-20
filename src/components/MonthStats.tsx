import type { CSSProperties } from 'react'
import type { AttendanceQuota, VacationBalance, VacationType } from '../types/models'
import { statusVisual, vacationTypeColor } from '../lib/statusColors'

interface Props {
  quota: AttendanceQuota
  quotaLabel: string
  balances: VacationBalance[]
  vacationTypes: VacationType[]
  homeofficeErlaubt: boolean
}

export function MonthStats({ quota, quotaLabel, balances, vacationTypes, homeofficeErlaubt }: Props) {
  const nameOf = (id: string) => vacationTypes.find((v) => v.id === id)?.name ?? id
  const colorOf = (id: string) => {
    const type = vacationTypes.find((v) => v.id === id)
    return type ? vacationTypeColor(type) : 'var(--color-primary)'
  }
  const quotaPercent = Math.min(100, quota.ratio * 100)

  return (
    <div className="card-grid">
      {homeofficeErlaubt && (
        <div className="card stat-tile">
          <span className="stat-label">Anwesenheitsquote ({quotaLabel})</span>
          <span className={`stat-value ${quota.meetsThreshold ? 'is-positive' : 'is-negative'}`}>
            {(quota.ratio * 100).toFixed(1)}%
          </span>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${quotaPercent}%`,
                background: quota.meetsThreshold ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            />
          </div>
        </div>
      )}

      {balances.map((b) => {
        const ratio = b.totalDays > 0 ? Math.min(100, (b.usedDays / b.totalDays) * 100) : 0
        const hatched = statusVisual(b.vacationTypeId).hatched
        const fillClass = hatched ? 'progress-fill progress-fill--hatched' : 'progress-fill'
        const fillStyle: CSSProperties = hatched
          ? { width: `${ratio}%` }
          : { width: `${ratio}%`, background: colorOf(b.vacationTypeId) }
        return (
          <div key={b.vacationTypeId} className="card stat-tile">
            <span className="stat-label">{nameOf(b.vacationTypeId)}</span>
            <span className="stat-value">{b.remainingDays}</span>
            <div className="progress-track">
              <div className={fillClass} style={fillStyle} />
            </div>
            <span className="stat-sub">
              {b.usedDays} von {b.totalDays} genommen
            </span>
          </div>
        )
      })}
    </div>
  )
}
