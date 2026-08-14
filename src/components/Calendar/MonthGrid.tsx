import type { Bundesland, DayEntry, VacationType } from '../../types/models'
import { getMonthGrid, monthLabel, toIsoDate, weekdayLabel } from '../../lib/dates'
import { effectiveDayStatus } from '../../lib/attendance'
import { getHolidayName, isWeekend } from '../../lib/holidays'

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
      <h2>{monthLabel(year, month)}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
          <div key={w} style={{ fontWeight: 'bold', textAlign: 'center' }}>
            {w}
          </div>
        ))}
        {days.map((date) => {
          const inMonth = date.getMonth() === month
          const iso = toIsoDate(date)
          const holiday = getHolidayName(date, bundesland)
          const weekend = isWeekend(date)
          const entry = entries.get(iso)
          const status = effectiveDayStatus(date, bundesland, entry)

          return (
            <div
              key={iso}
              style={{
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: 4,
                opacity: inMonth ? 1 : 0.35,
                minHeight: 72,
              }}
            >
              <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>{date.getDate()}</span>
                <span>{weekdayLabel(date)}</span>
              </div>

              {weekend ? (
                <div style={{ fontSize: 12, color: '#888' }}>Wochenende</div>
              ) : holiday ? (
                <div style={{ fontSize: 12, color: '#888' }}>{holiday}</div>
              ) : inMonth ? (
                <select
                  value={typeof status === 'string' ? status : 'buero'}
                  onChange={(e) => handleSelect(date, e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <option value="buero">{statusLabel('buero')}</option>
                  <option value="homeoffice">{statusLabel('homeoffice')}</option>
                  <option value="dienstreise">{statusLabel('dienstreise')}</option>
                  {vacationTypes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
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
