import { useMemo } from 'react'
import type { DayEntry, UserProfile, VacationType } from '../types/models'
import { DEFAULT_ARBEITSTAGE, DEFAULT_VACATION_TYPE_IDS, NO_AG_FREIE_TAGE } from '../types/models'
import { getYearDays } from '../lib/dates'
import { calculateVacationBalances } from '../lib/vacation'
import { vacationTypesForYear } from '../lib/vacationTypes'
import { useYearEntries } from './useYearEntries'

/**
 * Ungenutzte Urlaubstage der Art "Urlaub" aus dem Vorjahr (Issue #74). Der
 * Resturlaub des Vorjahres verfällt und wird nicht erneut übertragen.
 * `undefined`, wenn es im Vorjahr keine Einträge gibt (App war noch nicht im
 * Einsatz) — dann bleibt der Resturlaub wie gepflegt.
 */
export function carryOverFromPreviousYear(
  profile: UserProfile,
  year: number,
  previousEntries: Map<string, DayEntry>,
): number | undefined {
  if (previousEntries.size === 0) return undefined

  const previousTypes = vacationTypesForYear(profile, year - 1)
  const balances = calculateVacationBalances(
    getYearDays(year - 1),
    profile.bundesland,
    profile.agFreieTage ?? NO_AG_FREIE_TAGE,
    previousEntries,
    previousTypes,
    profile.arbeitstage ?? DEFAULT_ARBEITSTAGE,
  )
  const urlaub = balances.find((b) => b.vacationTypeId === DEFAULT_VACATION_TYPE_IDS.urlaub)
  return Math.max(0, urlaub?.remainingDays ?? 0)
}

/** Urlaubsarten für `year` inkl. automatischem Resturlaub-Übertrag aus dem Vorjahr. */
export function useVacationTypes(
  profile: UserProfile,
  year: number,
): { vacationTypes: VacationType[]; carryOver: number | undefined } {
  const previousEntries = useYearEntries(profile.uid, year - 1)
  return useMemo(() => {
    const carryOver = carryOverFromPreviousYear(profile, year, previousEntries)
    return { vacationTypes: vacationTypesForYear(profile, year, carryOver), carryOver }
  }, [profile, year, previousEntries])
}
