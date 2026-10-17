import type { AgFreierTag, BaseDayStatus, Bundesland, DayEntry, Weekday } from '../types/models'
import { toIsoDate } from './dates'
import { effectiveDayStatus } from './attendance'

/** Stati, an denen für die Pendlerpauschale eine Wegstrecke anfällt (nur Büro, Dienstreisen zählen nicht). */
const COMMUTE_STATUSES: readonly BaseDayStatus[] = ['buero']

export function isCommuteStatus(status: string): boolean {
  return (COMMUTE_STATUSES as readonly string[]).includes(status)
}

/** Gilt eine am Tageseintrag gespeicherte Strecke (DayEntry.distanceKm), sonst die Standardstrecke aus dem Profil. */
export function effectiveDistanceKm(entry: DayEntry | undefined, defaultKm: number): number {
  return entry?.distanceKm ?? defaultKm
}

export interface CommuteSummary {
  /** Summe der Wegstrecke aller Büro-Tage (Standardstrecke oder Override). */
  totalKm: number
  /** Anzahl Büro-Tage. */
  days: number
  /** Davon Tage mit abweichender Tagesstrecke. */
  overrideDays: number
}

/**
 * Jahres-Summe der Wegstrecke für die Pendlerpauschale (Abschnitt 5.3).
 * Gezählt werden nur Tage bis einschließlich `until`, damit noch nicht
 * stattgefundene Tage (Fallback "Büro") die Summe nicht aufblähen.
 */
export function calculateCommuteSummary(
  days: Date[],
  bundesland: Bundesland,
  agFreieTage: readonly AgFreierTag[],
  entries: Map<string, DayEntry>,
  defaultKm: number,
  arbeitstage: readonly Weekday[],
  until: Date = new Date(),
): CommuteSummary {
  const untilIso = toIsoDate(until)
  let totalKm = 0
  let dayCount = 0
  let overrideDays = 0

  for (const date of days) {
    const iso = toIsoDate(date)
    if (iso > untilIso) continue
    const entry = entries.get(iso)
    const status = effectiveDayStatus(date, bundesland, agFreieTage, entry, arbeitstage)
    if (typeof status !== 'string' || !isCommuteStatus(status)) continue
    dayCount++
    totalKm += effectiveDistanceKm(entry, defaultKm)
    if (entry?.distanceKm !== undefined) overrideDays++
  }

  return { totalKm, days: dayCount, overrideDays }
}
