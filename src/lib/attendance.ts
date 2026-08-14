import type { AttendanceQuota, BaseDayStatus, Bundesland, DayEntry, UserProfile, Weekday } from '../types/models'
import { isArbeitstag, toIsoDate } from './dates'
import { getHolidayName } from './holidays'

/**
 * Effektiver Status eines Tages inkl. Fallback-Logik (Abschnitt 5.2):
 * arbeitsfreie Tage (UserProfile.arbeitstage, Issue #34) und Feiertage sind
 * nie editierbar und zählen nie mit; ein Arbeitstag ohne Eintrag gilt
 * automatisch als `buero`.
 */
export function effectiveDayStatus(
  date: Date,
  bundesland: Bundesland,
  entry: DayEntry | undefined,
  arbeitstage: readonly Weekday[],
): BaseDayStatus | string | 'wochenende' | 'feiertag' {
  if (!isArbeitstag(date, arbeitstage)) return 'wochenende'
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
  arbeitstage: readonly Weekday[],
): AttendanceQuota {
  let officeDays = 0
  let homeofficeDays = 0
  let businessTripDays = 0

  for (const date of days) {
    const status = effectiveDayStatus(date, bundesland, entries.get(toIsoDate(date)), arbeitstage)
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
