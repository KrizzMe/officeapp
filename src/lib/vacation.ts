import type { Bundesland, DayEntry, VacationBalance, VacationType } from '../types/models'
import { parseIsoDate, toIsoDate } from './dates'
import { effectiveDayStatus } from './attendance'

/** Verbleibende Tage je Urlaubsart plus Gesamtsumme (Abschnitt 5.4). */
export function calculateVacationBalances(
  days: Date[],
  bundesland: Bundesland,
  entries: Map<string, DayEntry>,
  vacationTypes: VacationType[],
): VacationBalance[] {
  const usedByType = new Map<string, number>()

  for (const date of days) {
    const status = effectiveDayStatus(date, bundesland, entries.get(toIsoDate(date)))
    if (typeof status !== 'string') continue
    if (status === 'buero' || status === 'homeoffice' || status === 'dienstreise') continue
    if (status === 'wochenende' || status === 'feiertag') continue
    usedByType.set(status, (usedByType.get(status) ?? 0) + 1)
  }

  return vacationTypes.map((type) => {
    const usedDays = usedByType.get(type.id) ?? 0
    return {
      vacationTypeId: type.id,
      totalDays: type.totalDays,
      usedDays,
      remainingDays: type.totalDays - usedDays,
    }
  })
}

function quarterOf(date: Date): number {
  return Math.floor(date.getMonth() / 3)
}

/**
 * Prüft die Rhythmus-Regel einer Urlaubsart (Abschnitt 5.5, z. B. "1
 * Dispositionstag pro Quartal") für einen neuen Eintrag an `date`.
 * `entries` sind die bereits vorhandenen Einträge desselben Nutzers/Jahres
 * (ohne den neuen, zu prüfenden Tag).
 */
export function checkRhythmViolation(
  date: Date,
  vacationType: VacationType,
  entries: Map<string, DayEntry>,
): { violated: boolean; usedInPeriod: number } {
  if (!vacationType.rhythm) return { violated: false, usedInPeriod: 0 }

  if (vacationType.rhythm.kind === 'quarterly') {
    const targetQuarter = quarterOf(date)
    let usedInPeriod = 0
    for (const entry of entries.values()) {
      if (entry.status !== vacationType.id) continue
      const entryDate = parseIsoDate(entry.date)
      if (entryDate.getFullYear() === date.getFullYear() && quarterOf(entryDate) === targetQuarter) {
        usedInPeriod++
      }
    }
    return { violated: usedInPeriod >= vacationType.rhythm.maxPerPeriod, usedInPeriod }
  }

  return { violated: false, usedInPeriod: 0 }
}
