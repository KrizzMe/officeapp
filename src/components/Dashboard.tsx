import type { AttendanceQuota, VacationBalance, VacationType } from '../types/models'
import { vacationTypeColor } from '../lib/statusColors'

interface Props {
  quota: AttendanceQuota
  quotaLabel: string
  balances: VacationBalance[]
  vacationTypes: VacationType[]
}

export function Dashboard({ quota, quotaLabel, balances, vacationTypes }: Props) {
  const nameOf = (id: string) => vacationTypes.find((v) => v.id === id)?.name ?? id
  const colorOf = (id: string) => {
    const type = vacationTypes.find((v) => v.id === id)
    return type ? vacationTypeColor(type) : 'var(--color-primary)'
  }
  const totalRemaining = balances.reduce((sum, b) => sum + b.remainingDays, 0)
  const quotaPercent = Math.min(100, quota.ratio * 100)

  return (
    <div className="card-grid">
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
        <span className="stat-sub">
          Büro {quota.officeDays} + Dienstreise {quota.businessTripDays} von {quota.possibleWorkDays} möglichen
          Arbeitstagen · Ziel ≥ 40%
        </span>
      </div>

      <div className="card stat-tile">
        <span className="stat-label">Urlaub gesamt verbleibend</span>
        <span className="stat-value">{totalRemaining} Tage</span>
      </div>

      {balances.map((b) => {
        const ratio = b.totalDays > 0 ? Math.min(100, (b.usedDays / b.totalDays) * 100) : 0
        return (
          <div key={b.vacationTypeId} className="card stat-tile">
            <span className="stat-label">{nameOf(b.vacationTypeId)}</span>
            <span className="stat-value">{b.remainingDays}</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${ratio}%`, background: colorOf(b.vacationTypeId) }} />
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
