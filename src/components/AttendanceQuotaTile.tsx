import type { AttendanceQuota } from '../types/models'

interface Props {
  quota: AttendanceQuota
  /** Zeitraum-Bezeichnung für den Hinweistext unter dem Fortschrittsbalken, z. B. "August 2026" oder "Durchschnitt Jahr 2026". */
  periodLabel: string
}

/** Anwesenheitsquote-Kachel, gemeinsam genutzt von HomeDashboard, MonthStats und YearOverview. */
export function AttendanceQuotaTile({ quota, periodLabel }: Props) {
  const quotaPercent = Math.min(100, quota.ratio * 100)

  return (
    <div className="card stat-tile">
      <span className="stat-label">Anwesenheitsquote</span>
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
      <span className="stat-sub">{periodLabel}</span>
    </div>
  )
}
