import type { UserProfile, VacationType } from '../types/models'
import { DEFAULT_VACATION_TYPE_IDS } from '../types/models'

/**
 * Urlaubsarten, die für `year` gelten (Issue #72). Hat das Profil für das Jahr
 * eine eigene Liste, gilt diese. Sonst wird vom nächstfrüheren Jahr mit Liste
 * abgeleitet (bzw. von der globalen Liste aus Profilen von vor #72, die als
 * Stand des aktuellen Kalenderjahres gilt): alles wird übernommen, nur der
 * Resturlaub aus dem Vorjahr startet in einem späteren Jahr bei 0.
 */
export function vacationTypesForYear(profile: UserProfile, year: number): VacationType[] {
  const byYear = profile.vacationTypesByYear ?? {}
  const own = byYear[String(year)]
  if (own) return own

  const earlier = Object.keys(byYear)
    .map(Number)
    .filter((y) => y < year)
    .sort((a, b) => b - a)[0]
  const sourceYear = earlier ?? new Date().getFullYear()
  const source = earlier !== undefined ? byYear[String(earlier)] : profile.vacationTypes

  // Jahre vor dem Quellstand: unverändert, nur spätere Jahre setzen den Resturlaub zurück.
  if (earlier === undefined && year <= sourceYear) return source
  return source.map((t) => (t.id === DEFAULT_VACATION_TYPE_IDS.resturlaub ? { ...t, totalDays: 0 } : t))
}
