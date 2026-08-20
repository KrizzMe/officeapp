import type { Weekday } from '../types/models'
import { ALL_WEEKDAYS } from '../types/models'

export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parst ein "YYYY-MM-DD" als lokales Datum (Mitternacht in der Zeitzone des
 * Nutzers). `new Date("YYYY-MM-DD")` parst laut Spec als UTC, was am Rande
 * von Zeitzonen den falschen Kalendertag ergibt — deshalb nicht verwenden.
 */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const MONTH_LABELS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export function weekdayLabel(date: Date): Weekday {
  return ALL_WEEKDAYS[(date.getDay() + 6) % 7]
}

/** Ob `date` laut den konfigurierten Arbeitstagen ein Arbeitstag ist (Issue #34). */
export function isArbeitstag(date: Date, arbeitstage: readonly Weekday[]): boolean {
  return arbeitstage.includes(weekdayLabel(date))
}

/**
 * Ob `date` in einem strikt zukünftigen Monat liegt (nicht im Monat von
 * `today`, nicht davor). Grenze für die Homeoffice-Wochentage-Vorbelegung
 * (Issue #39) — stellt sicher, dass sich Änderungen daran nie auf den
 * aktuellen oder vergangene Monate auswirken.
 */
export function isFutureMonth(date: Date, today: Date = new Date()): boolean {
  if (date.getFullYear() !== today.getFullYear()) return date.getFullYear() > today.getFullYear()
  return date.getMonth() > today.getMonth()
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month]} ${year}`
}

/**
 * Alle Tage einer Monatsansicht (inkl. Auffüll-Tagen aus Vor-/Folgemonat,
 * sodass volle Wochen Mo-So entstehen).
 */
export function getMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Montag = 0
  const gridStart = new Date(year, month, 1 - startOffset)

  const lastOfMonth = new Date(year, month + 1, 0)
  const endOffset = 6 - ((lastOfMonth.getDay() + 6) % 7)
  const gridEnd = new Date(year, month + 1, endOffset)

  const days: Date[] = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function getMonthDays(year: number, month: number): Date[] {
  const lastOfMonth = new Date(year, month + 1, 0)
  const days: Date[] = []
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  return days
}

export function getYearDays(year: number): Date[] {
  const days: Date[] = []
  for (let m = 0; m < 12; m++) days.push(...getMonthDays(year, m))
  return days
}
