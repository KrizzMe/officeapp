import type { CSSProperties } from 'react'
import type { AgFreierTag, Bundesland, DayEntry, VacationType, Weekday } from '../../types/models'
import { ALL_WEEKDAYS } from '../../types/models'
import { getMonthGrid, isArbeitstag, toIsoDate, weekdayLabel } from '../../lib/dates'
import { effectiveDayStatus } from '../../lib/attendance'
import { getHolidayName, isWeekend } from '../../lib/holidays'
import { getAgFreierTagName } from '../../lib/agFreieTage'
import { statusVisual } from '../../lib/statusColors'
import { buildStatusOptions, statusLabel } from '../../lib/statusOptions'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { StatusDropdown } from './StatusDropdown'

interface Props {
  year: number
  month: number
  bundesland: Bundesland
  /** Zusätzliche AG-freie Tage (UserProfile.agFreieTage, Issue #37). */
  agFreieTage: readonly AgFreierTag[]
  entries: Map<string, DayEntry>
  vacationTypes: VacationType[]
  /** Ob der Status 'homeoffice' im Dropdown auswählbar ist (UserProfile.homeofficeErlaubt). */
  homeofficeErlaubt: boolean
  /** An welchen Wochentagen der Nutzer arbeitet (UserProfile.arbeitstage, Issue #34). */
  arbeitstage: readonly Weekday[]
  /** An welchen Wochentagen der Nutzer i. d. R. im Homeoffice ist (UserProfile.homeofficeWeekdays, Issue #39). */
  homeofficeWeekdays: readonly Weekday[]
  onStatusChange: (date: Date, status: string) => void
  onClearStatus: (date: Date) => void
}

export function MonthGrid({
  year,
  month,
  bundesland,
  agFreieTage,
  entries,
  vacationTypes,
  homeofficeErlaubt,
  arbeitstage,
  homeofficeWeekdays,
  onStatusChange,
  onClearStatus,
}: Props) {
  const days = getMonthGrid(year, month)
  const todayIso = toIsoDate(new Date())
  // Unter 640px ist die Tageszelle zu schmal, um im geschlossenen Zustand
  // Icon + Text zu zeigen. Beim Öffnen der Auswahl (eigene Dropdown-Liste,
  // s. StatusDropdown) bleibt der Text unabhängig davon immer sichtbar
  // (Issue #36).
  const isMobile = useMediaQuery('(max-width: 639px)')

  /**
   * Ein gewählter Status, der dem berechneten Default entspricht (i. d. R.
   * `buero`, für zukünftige Homeoffice-Wochentage aber `homeoffice`, Issue
   * #39), wird nicht als Eintrag geschrieben, sondern der Tag bleibt/wird
   * wieder eine Ausnahme-freie Fallback-Zelle.
   */
  const handleSelect = (date: Date, value: string, defaultStatus: string) => {
    if (value === defaultStatus) {
      onClearStatus(date)
    } else {
      onStatusChange(date, value)
    }
  }

  return (
    <div style={{ '--workday-count': arbeitstage.length } as CSSProperties}>
      <div className="weekday-row">
        {ALL_WEEKDAYS.map((w) => (
          <div key={w} className={arbeitstage.includes(w) ? undefined : 'is-non-workday'}>
            {w}
          </div>
        ))}
      </div>
      <div className="month-grid">
        {days.map((date) => {
          const inMonth = date.getMonth() === month
          const iso = toIsoDate(date)
          const holiday = getHolidayName(date, bundesland) ?? getAgFreierTagName(date, agFreieTage)
          const workday = isArbeitstag(date, arbeitstage)
          const entry = entries.get(iso)
          const status = effectiveDayStatus(date, bundesland, agFreieTage, entry, arbeitstage, homeofficeWeekdays)
          const statusId = typeof status === 'string' ? status : 'buero'
          const defaultStatus = effectiveDayStatus(
            date,
            bundesland,
            agFreieTage,
            undefined,
            arbeitstage,
            homeofficeWeekdays,
          )
          const defaultStatusId = typeof defaultStatus === 'string' ? defaultStatus : 'buero'
          const visual = statusVisual(statusId)
          const muted = !workday || !!holiday

          const cellClass = [
            'day-cell',
            !inMonth && 'day-cell--outside',
            muted && 'day-cell--muted',
            !workday && 'is-non-workday',
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

              {!workday ? (
                <div className="day-note">{isWeekend(date) ? 'Wochenende' : 'Arbeitsfrei'}</div>
              ) : holiday ? (
                <div className="day-note">{holiday}</div>
              ) : inMonth ? (
                <StatusDropdown
                  value={statusId}
                  options={buildStatusOptions(vacationTypes, homeofficeErlaubt, statusId)}
                  onChange={(v) => handleSelect(date, v, defaultStatusId)}
                  color={visual.color}
                  hatched={visual.hatched}
                  showLabelWhenClosed={!isMobile}
                  ariaLabel={`Status für ${date.getDate()}. ${date.toLocaleDateString('de-DE', { month: 'long' })}: ${statusLabel(statusId, vacationTypes)}`}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
