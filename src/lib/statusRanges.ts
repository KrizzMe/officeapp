import type { AgFreierTag, BaseDayStatus, Bundesland, DayEntry, Weekday } from '../types/models'
import { effectiveDayStatus } from './attendance'
import { getYearDays, toIsoDate } from './dates'

/**
 * Ein zusammenhängender Zeitraum eines Basis-Status (Dienstreise/Krank/Kind-krank,
 * Issue #33). `start`/`end` können ein Wochenende oder einen Feiertag einschließen,
 * wenn dieser zwischen zwei Tagen desselben Status liegt (z. B. Dienstreise Fr-Mo)
 * — `entries` enthält aber nur die tatsächlich erfassten Tage, `days` zählt entsprechend nur diese.
 */
export interface DayRange {
  start: Date
  end: Date
  days: number
  entries: DayEntry[]
}

/**
 * Gruppiert die Tage eines Jahres mit gegebenem Status zu zusammenhängenden
 * Zeiträumen (Issue #33). Ein Wochenende oder Feiertag zwischen zwei Tagen
 * desselben Status unterbricht den Zeitraum nicht, jeder andere Status
 * (auch die Fallback-Logik 'buero') beendet ihn.
 */
export function computeStatusRanges(
  year: number,
  status: BaseDayStatus,
  bundesland: Bundesland,
  agFreieTage: readonly AgFreierTag[],
  entries: Map<string, DayEntry>,
  arbeitstage: readonly Weekday[],
): DayRange[] {
  const ranges: DayRange[] = []
  let start: Date | null = null
  let end: Date | null = null
  let rangeEntries: DayEntry[] = []

  const flush = () => {
    if (start && end) ranges.push({ start, end, days: rangeEntries.length, entries: rangeEntries })
    start = null
    end = null
    rangeEntries = []
  }

  for (const date of getYearDays(year)) {
    const iso = toIsoDate(date)
    const effective = effectiveDayStatus(date, bundesland, agFreieTage, entries.get(iso), arbeitstage)

    if (effective === status) {
      if (!start) start = date
      end = date
      rangeEntries.push(entries.get(iso)!)
    } else if (effective === 'wochenende' || effective === 'feiertag') {
      // überbrückt einen offenen Zeitraum, siehe Doku oben
    } else {
      flush()
    }
  }
  flush()

  return ranges
}
