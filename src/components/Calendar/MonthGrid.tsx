import type { CSSProperties } from 'react'
import type { Bundesland, DayEntry, VacationType } from '../../types/models'
import { getMonthGrid, toIsoDate, weekdayLabel } from '../../lib/dates'
import { effectiveDayStatus } from '../../lib/attendance'
import { getHolidayName, isWeekend } from '../../lib/holidays'
import { statusVisual } from '../../lib/statusColors'

interface Props {
  year: number
  month: number
  bundesland: Bundesland
  entries: Map<string, DayEntry>
  vacationTypes: VacationType[]
  onStatusChange: (date: Date, status: string) => void
  onClearStatus: (date: Date) => void
}

const STATUS_LABELS: Record<string, string> = {
  buero: 'Büro',
  homeoffice: 'Homeoffice',
  dienstreise: 'Dienstreise',
}

export function MonthGrid({
  year,
  month,
  bundesland,
  entries,
  vacationTypes,
  onStatusChange,
  onClearStatus,
}: Props) {
  const days = getMonthGrid(year, month)
  const todayIso = toIsoDate(new Date())

  const statusLabel = (id: string) =>
    STATUS_LABELS[id] ?? vacationTypes.find((v) => v.id === id)?.name ?? id

  const handleSelect = (date: Date, value: string) => {
    if (value === 'buero') {
      onClearStatus(date)
    } else {
      onStatusChange(date, value)
    }
  }

  return (
    <div>
      <div className="weekday-row">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="month-grid">
        {days.map((date) => {
          const inMonth = date.getMonth() === month
          const iso = toIsoDate(date)
          const holiday = getHolidayName(date, bundesland)
          const weekend = isWeekend(date)
          const entry = entries.get(iso)
          const status = effectiveDayStatus(date, bundesland, entry)
          const statusId = typeof status === 'string' ? status : 'buero'
          const visual = statusVisual(statusId)
          const muted = weekend || !!holiday

          const cellClass = [
            'day-cell',
            !inMonth && 'day-cell--outside',
            muted && 'day-cell--muted',
            iso === todayIso && 'day-cell--today',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div key={iso} className={cellClass}>
              <div className="day-number-row">
                <span>{date.getDate()}</span>
                <span>{weekdayLabel(date)}</span>
              </div>

              {weekend ? (
                <div className="day-note">Wochenende</div>
              ) : holiday ? (
                <div className="day-note">{holiday}</div>
              ) : inMonth ? (
                <select
                  className="day-status-select"
                  style={{ '--status-color': visual.color } as CSSProperties}
                  value={statusId}
                  onChange={(e) => handleSelect(date, e.target.value)}
                >
                  <option value="buero">🏢 {statusLabel('buero')}</option>
                  <option value="homeoffice">🏠 {statusLabel('homeoffice')}</option>
                  <option value="dienstreise">✈️ {statusLabel('dienstreise')}</option>
                  {vacationTypes.map((v) => (
                    <option key={v.id} value={v.id}>
                      🌴 {v.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
