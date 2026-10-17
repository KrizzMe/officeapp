import type { CommuteSummary } from '../lib/commute'
import type { AttendanceQuota, VacationBalance, VacationType } from '../types/models'
import { AttendanceQuotaTile } from './AttendanceQuotaTile'
import { CommuteKmTile } from './CommuteKmTile'
import { VacationBalanceTile } from './VacationBalanceTile'

interface Props {
  quota: AttendanceQuota
  quotaLabel: string
  /** Arbeitsweg-km des angezeigten Monats (Abschnitt 5.3). */
  commute: CommuteSummary
  /** Anzahl Krankheitstage (`krank`) des angezeigten Monats; die Kachel erscheint nur bei > 0. */
  krankDays: number
  /** Reiner Monatsname für die Titel der Arbeitsweg-/Krankheitstage-Kachel. */
  monthName: string
  balances: VacationBalance[]
  vacationTypes: VacationType[]
  homeofficeErlaubt: boolean
  /** Jahr, auf das sich die Urlaubssalden beziehen (für den Hinweistext der Kacheln). */
  year: number
}

export function MonthStats({
  quota,
  quotaLabel,
  commute,
  krankDays,
  monthName,
  balances,
  vacationTypes,
  homeofficeErlaubt,
  year,
}: Props) {
  return (
    <div className="card-grid">
      {homeofficeErlaubt && <AttendanceQuotaTile quota={quota} periodLabel={quotaLabel} />}

      {balances.map((b) => {
        const vacationType = vacationTypes.find((v) => v.id === b.vacationTypeId)
        if (!vacationType) return null
        return <VacationBalanceTile key={b.vacationTypeId} balance={b} vacationType={vacationType} year={year} />
      })}

      <CommuteKmTile summary={commute} periodLabel={monthName} />

      {quota.businessTripDays > 0 && (
        <div className="card stat-tile">
          <span className="stat-label">Dienstreisen {monthName}</span>
          <span className="stat-value">{quota.businessTripDays}</span>
          <span className="stat-sub">Tage im Monat</span>
        </div>
      )}

      {krankDays > 0 && (
        <div className="card stat-tile">
          <span className="stat-label">Krankheitstage {monthName}</span>
          <span className="stat-value">{krankDays}</span>
          <span className="stat-sub">Tage im Monat</span>
        </div>
      )}
    </div>
  )
}
