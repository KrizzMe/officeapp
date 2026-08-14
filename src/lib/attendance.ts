import type { AttendanceQuota, BaseDayStatus, Bundesland, DayEntry } from '../types/models'
import { toIsoDate } from './dates'
import { getHolidayName, isWeekend } from './holidays'

/**
 * Effektiver Status eines Tages inkl. Fallback-Logik (Abschnitt 5.2):
 * Wochenende/Feiertag sind nie editierbar und zählen nie mit; ein Werktag
 * ohne Eintrag gilt automatisch als `buero`.
 */
export function effectiveDayStatus(
  date: Date,
  bundesland: Bundesland,
  entry: DayEntry | undefined,
): BaseDayStatus | string | 'wochenende' | 'feiertag' {
  if (isWeekend(date)) return 'wochenende'
  const holiday = getHolidayName(date, bundesland)
  if (holiday) return 'feiertag'
  return entry?.status ?? 'buero'
}

const BASE_STATUSES: readonly BaseDayStatus[] = ['buero', 'homeoffice', 'dienstreise']

/** Berechnet die 40/60-Anwesenheitsquote (Abschnitt 5.1) über eine Liste von Tagen. */
export function calculateAttendanceQuota(
  days: Date[],
  bundesland: Bundesland,
  entries: Map<string, DayEntry>,
): AttendanceQuota {
  let officeDays = 0
  let homeofficeDays = 0
  let businessTripDays = 0

  for (const date of days) {
    const status = effectiveDayStatus(date, bundesland, entries.get(toIsoDate(date)))
    if (status === 'buero') officeDays++
    else if (status === 'homeoffice') homeofficeDays++
    else if (status === 'dienstreise') businessTripDays++
  }

  const possibleWorkDays = officeDays + homeofficeDays + businessTripDays
  const ratio = possibleWorkDays === 0 ? 0 : (officeDays + businessTripDays) / possibleWorkDays

  return {
    officeDays,
    homeofficeDays,
    businessTripDays,
    possibleWorkDays,
    ratio,
    meetsThreshold: ratio >= 0.4,
  }
}

export { BASE_STATUSES }
