import type { AttendanceQuota, VacationBalance, VacationType } from '../types/models'

interface Props {
  quota: AttendanceQuota
  balances: VacationBalance[]
  vacationTypes: VacationType[]
}

export function Dashboard({ quota, balances, vacationTypes }: Props) {
  const nameOf = (id: string) => vacationTypes.find((v) => v.id === id)?.name ?? id
  const totalRemaining = balances.reduce((sum, b) => sum + b.remainingDays, 0)

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, minWidth: 200 }}>
        <strong>Anwesenheitsquote (dieser Monat)</strong>
        <div style={{ fontSize: 24, color: quota.meetsThreshold ? 'green' : 'crimson' }}>
          {(quota.ratio * 100).toFixed(1)}%
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          Büro {quota.officeDays} + Dienstreise {quota.businessTripDays} von {quota.possibleWorkDays} möglichen
          Arbeitstagen · Ziel ≥ 40%
        </div>
      </div>

      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, minWidth: 200 }}>
        <strong>Urlaub gesamt verbleibend</strong>
        <div style={{ fontSize: 24 }}>{totalRemaining} Tage</div>
      </div>

      {balances.map((b) => (
        <div key={b.vacationTypeId} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, minWidth: 160 }}>
          <strong>{nameOf(b.vacationTypeId)}</strong>
          <div style={{ fontSize: 24 }}>{b.remainingDays}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {b.usedDays} von {b.totalDays} genommen
          </div>
        </div>
      ))}
    </div>
  )
}
