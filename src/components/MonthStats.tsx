import type { AttendanceQuota, VacationBalance, VacationType } from '../types/models'
import { AttendanceQuotaTile } from './AttendanceQuotaTile'
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
  return (
    <div className="card-grid">
      {homeofficeErlaubt && <AttendanceQuotaTile quota={quota} periodLabel={quotaLabel} />}

      {balances.map((b) => {
        const vacationType = vacationTypes.find((v) => v.id === b.vacationTypeId)
        if (!vacationType) return null
        return <VacationBalanceTile key={b.vacationTypeId} balance={b} vacationType={vacationType} year={year} />
      })}
    </div>
  )
}
