import type { CSSProperties } from 'react'
import type { AgFreierTag, Bundesland, DayEntry, VacationType, Weekday } from '../../types/models'
import { ALL_WEEKDAYS } from '../../types/models'
import { getMonthGrid, isArbeitstag, toIsoDate, weekdayLabel } from '../../lib/dates'
import { effectiveDayStatus } from '../../lib/attendance'
import { getHolidayName, isWeekend } from '../../lib/holidays'
import { getAgFreierTagName } from '../../lib/agFreieTage'
import { statusVisual } from '../../lib/statusColors'
import { buildStatusOptions, statusLabel } from '../../lib/statusOptions'
import { arbeitszeitOf, berechneNetto, formatDauer, istZeiterfassungsStatus } from '../../lib/arbeitszeit'
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
  /** Neuer Status samt berechnetem Default des Tages (entspricht er dem Default, fällt der Tag auf die Fallback-Logik zurück). */
  onStatusChange: (date: Date, status: string, defaultStatus: string) => void
  /** Öffnet die Arbeitszeit-Eingabe für einen Büro-/Homeoffice-Tag (Issue #83). */
  onEditZeit: (date: Date) => void
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
  onEditZeit,
}: Props) {
  const days = getMonthGrid(year, month)
  const todayIso = toIsoDate(new Date())
  // Unter 640px ist die Tageszelle zu schmal, um im geschlossenen Zustand
  // Icon + Text zu zeigen. Beim Öffnen der Auswahl (eigene Dropdown-Liste,
  // s. StatusDropdown) bleibt der Text unabhängig davon immer sichtbar
  // (Issue #36).
  const isMobile = useMediaQuery('(max-width: 639px)')

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
                  onChange={(v) => onStatusChange(date, v, defaultStatusId)}
                  color={visual.color}
                  hatched={visual.hatched}
                  showLabelWhenClosed={!isMobile}
                  ariaLabel={`Status für ${date.getDate()}. ${date.toLocaleDateString('de-DE', { month: 'long' })}: ${statusLabel(statusId, vacationTypes)}`}
                />
              ) : null}

              {workday && !holiday && inMonth && istZeiterfassungsStatus(statusId) && (
                <ZeitButton
                  date={date}
                  netto={(() => {
                    const zeit = arbeitszeitOf(entry)
                    return zeit ? (berechneNetto(zeit)?.nettoMin ?? null) : null
                  })()}
                  fehlt={iso < todayIso}
                  compact={isMobile}
                  onClick={() => onEditZeit(date)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ZeitButtonProps {
  date: Date
  /** Netto-Arbeitszeit in Minuten, `null` ohne (gültige) Zeiten. */
  netto: number | null
  /** Vergangener Tag: fehlende Zeiten zählen als Minusstunden und werden hervorgehoben. */
  fehlt: boolean
  compact: boolean
  onClick: () => void
}

/** Zeitzeile einer Tageszelle (Issue #83): Netto-Arbeitszeit oder Hinweis auf fehlende Zeiten. */
function ZeitButton({ date, netto, fehlt, compact, onClick }: ZeitButtonProps) {
  const tag = `${date.getDate()}. ${date.toLocaleDateString('de-DE', { month: 'long' })}`
  if (netto !== null) {
    return (
      <button type="button" className="day-zeit day-zeit--erfasst" onClick={onClick} aria-label={`Arbeitszeit ${tag}: ${formatDauer(netto)} Stunden, bearbeiten`}>
        {formatDauer(netto)}
      </button>
    )
  }
  return (
    <button
      type="button"
      className={fehlt ? 'day-zeit day-zeit--fehlt' : 'day-zeit'}
      onClick={onClick}
      aria-label={`Arbeitszeit ${tag} ${fehlt ? 'fehlt' : 'eintragen'}`}
    >
      {compact ? '⏱' : fehlt ? '⏱ fehlt' : '⏱ +'}
    </button>
  )
}
