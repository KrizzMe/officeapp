import type { AttendanceQuota, VacationBalance, VacationType } from '../types/models'
import { VacationBalanceTile } from './VacationBalanceTile'

interface Props {
  quota: AttendanceQuota
  quotaLabel: string
  balances: VacationBalance[]
  vacationTypes: VacationType[]
  homeofficeErlaubt: boolean
  /** Jahr, auf das sich die Urlaubssalden beziehen (für den Hinweistext der Kacheln). */
  year: number
}

export function MonthStats({ quota, quotaLabel, balances, vacationTypes, homeofficeErlaubt, year }: Props) {
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
        const vacationType = vacationTypes.find((v) => v.id === b.vacationTypeId)
        if (!vacationType) return null
        return <VacationBalanceTile key={b.vacationTypeId} balance={b} vacationType={vacationType} year={year} />
      })}
    </div>
  )
}
