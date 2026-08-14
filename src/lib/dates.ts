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

export function isWeekendLocal(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTH_LABELS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export function weekdayLabel(date: Date): string {
  return WEEKDAY_LABELS[(date.getDay() + 6) % 7]
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
