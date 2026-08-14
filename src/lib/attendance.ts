import type { AttendanceQuota, BaseDayStatus, Bundesland, DayEntry, UserProfile } from '../types/models'
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

/**
 * Geforderte Mindest-Anwesenheitsquote eines Nutzers (1 - homeofficeQuote/100).
 * Ist Homeoffice nicht erlaubt, wird 100% Anwesenheit gefordert. Ersetzt die
 * frühere, für alle Nutzer fest verdrahtete 40%-Schwelle durch einen Wert
 * pro Profil (Abschnitt 5.1) — z. B. für zwei Nutzer mit unterschiedlichen
 * Arbeitgeber-Vorgaben.
 */
export function requiredOfficeRatio(profile: Pick<UserProfile, 'homeofficeErlaubt' | 'homeofficeQuote'>): number {
  if (profile.homeofficeErlaubt === false) return 1
  const quote = profile.homeofficeQuote ?? 60
  return Math.max(0, Math.min(1, 1 - quote / 100))
}

/** Berechnet die Anwesenheitsquote (Abschnitt 5.1) über eine Liste von Tagen. */
export function calculateAttendanceQuota(
  days: Date[],
  bundesland: Bundesland,
  entries: Map<string, DayEntry>,
  requiredRatio: number,
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
    requiredOfficeRatio: requiredRatio,
    meetsThreshold: ratio >= requiredRatio,
  }
}

export { BASE_STATUSES }
