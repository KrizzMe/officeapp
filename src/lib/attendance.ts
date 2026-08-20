import type { AgFreierTag, AttendanceQuota, BaseDayStatus, Bundesland, DayEntry, UserProfile, Weekday } from '../types/models'
import { isArbeitstag, isFutureMonth, toIsoDate, weekdayLabel } from './dates'
import { getHolidayName } from './holidays'
import { getAgFreierTagName } from './agFreieTage'

/**
 * Effektiver Status eines Tages inkl. Fallback-Logik (Abschnitt 5.2):
 * arbeitsfreie Tage (UserProfile.arbeitstage, Issue #34), Feiertage und
 * zusätzliche AG-freie Tage (UserProfile.agFreieTage, Issue #37) sind nie
 * editierbar und zählen nie mit; ein Arbeitstag ohne Eintrag gilt
 * automatisch als `buero` — außer für einen strikt zukünftigen Monat
 * (Issue #39): fällt der Tag auf einen der gewählten Homeoffice-Wochentage,
 * gilt er als `homeoffice`. Im aktuellen und in vergangenen Monaten greift
 * diese Vorbelegung nie, unabhängig von `today`.
 */
export function effectiveDayStatus(
  date: Date,
  bundesland: Bundesland,
  agFreieTage: readonly AgFreierTag[],
  entry: DayEntry | undefined,
  arbeitstage: readonly Weekday[],
  homeofficeWeekdays: readonly Weekday[] = [],
  today: Date = new Date(),
): BaseDayStatus | string | 'wochenende' | 'feiertag' {
  if (!isArbeitstag(date, arbeitstage)) return 'wochenende'
  const holiday = getHolidayName(date, bundesland) ?? getAgFreierTagName(date, agFreieTage)
  if (holiday) return 'feiertag'
  if (entry?.status) return entry.status
  if (isFutureMonth(date, today) && homeofficeWeekdays.includes(weekdayLabel(date))) return 'homeoffice'
  return 'buero'
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
  agFreieTage: readonly AgFreierTag[],
  entries: Map<string, DayEntry>,
  requiredRatio: number,
  arbeitstage: readonly Weekday[],
  homeofficeWeekdays: readonly Weekday[] = [],
): AttendanceQuota {
  let officeDays = 0
  let homeofficeDays = 0
  let businessTripDays = 0

  for (const date of days) {
    const status = effectiveDayStatus(
      date,
      bundesland,
      agFreieTage,
      entries.get(toIsoDate(date)),
      arbeitstage,
      homeofficeWeekdays,
    )
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

/** Anzahl Krankheitstage (`krank`, `kind-krank`, getrennt gezählt) über eine Liste von Tagen (Issue #31). */
export function calculateSickDays(
  days: Date[],
  bundesland: Bundesland,
  agFreieTage: readonly AgFreierTag[],
  entries: Map<string, DayEntry>,
  arbeitstage: readonly Weekday[],
): { krankDays: number; kindKrankDays: number } {
  let krankDays = 0
  let kindKrankDays = 0

  for (const date of days) {
    const status = effectiveDayStatus(date, bundesland, agFreieTage, entries.get(toIsoDate(date)), arbeitstage)
    if (status === 'krank') krankDays++
    else if (status === 'kind-krank') kindKrankDays++
  }

  return { krankDays, kindKrankDays }
}

export { BASE_STATUSES }
