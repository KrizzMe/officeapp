import type { UserProfile, VacationType } from '../types/models'
import { DEFAULT_VACATION_TYPE_IDS } from '../types/models'

/**
 * Urlaubsarten, die für `year` gelten (Issue #72). Hat das Profil für das Jahr
 * eine eigene Liste, gilt diese. Sonst wird vom nächstfrüheren Jahr mit Liste
 * abgeleitet (bzw. von der globalen Liste aus Profilen von vor #72, die als
 * Stand des aktuellen Kalenderjahres gilt): alles wird übernommen, nur der
 * Resturlaub aus dem Vorjahr startet in einem späteren Jahr bei 0.
 *
 * Ist `carryOver` gesetzt (Issue #74: ungenutzte Urlaubstage des Vorjahres),
 * ersetzt es den Resturlaub, sofern dieser nicht manuell überschrieben wurde.
 */
export function vacationTypesForYear(profile: UserProfile, year: number, carryOver?: number): VacationType[] {
  const base = baseVacationTypesForYear(profile, year)
  if (carryOver === undefined) return base

  const own = profile.vacationTypesByYear?.[String(year)]
  return base.map((t) => {
    if (t.id !== DEFAULT_VACATION_TYPE_IDS.resturlaub) return t
    const ownType = own?.find((o) => o.id === t.id)
    if (ownType && isCarryOverManual(ownType)) return t
    return { ...t, totalDays: carryOver, carryOverManual: false }
  })
}

/** Resturlaub manuell überschrieben? Altdaten ohne Flag: Wert > 0 gilt als manuell. */
export function isCarryOverManual(type: VacationType): boolean {
  return type.carryOverManual ?? type.totalDays > 0
}

function baseVacationTypesForYear(profile: UserProfile, year: number): VacationType[] {
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
