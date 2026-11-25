import { useEffect, useMemo, useState } from 'react'
import type { DayEntry, UserProfile } from '../types/models'
import { subscribeAllDayEntries } from '../firebase/firestore'
import { getYearDays } from '../lib/dates'
import type { ArbeitszeitKontext, ArbeitszeitSumme, Uebertrag } from '../lib/arbeitszeit'
import { berechneUebertrag, kontextAusProfil, summiereArbeitszeit } from '../lib/arbeitszeit'

export interface ArbeitszeitKonto {
  /** `null`, solange im Profil keine Wochenstunden hinterlegt sind. */
  ctx: ArbeitszeitKontext | null
  uebertrag: Uebertrag
  /** Summe des Jahres bis heute (zukünftige Tage zählen nicht). */
  jahr: ArbeitszeitSumme
  /** Übertrag + Jahressaldo. */
  gesamtSaldoMin: number
  loaded: boolean
}

const LEER: ArbeitszeitSumme = { sollMin: 0, istMin: 0, saldoMin: 0, fehlendeTage: 0 }

/** Überstunden-Konto eines Jahres inkl. Übertrag aus den Vorjahren (Issue #83). */
export function useArbeitszeitKonto(profile: UserProfile, year: number): ArbeitszeitKonto {
  const [allEntries, setAllEntries] = useState<Map<string, DayEntry> | null>(null)

  useEffect(() => subscribeAllDayEntries(profile.uid, setAllEntries), [profile.uid])

  return useMemo(() => {
    const ctx = kontextAusProfil(profile)
    if (!ctx || !allEntries) {
      return { ctx, uebertrag: { minuten: 0, manuell: false }, jahr: LEER, gesamtSaldoMin: 0, loaded: !!allEntries }
    }
    const uebertrag = berechneUebertrag(profile, year, allEntries, ctx)
    const jahr = summiereArbeitszeit(getYearDays(year), allEntries, ctx)
    return { ctx, uebertrag, jahr, gesamtSaldoMin: uebertrag.minuten + jahr.saldoMin, loaded: true }
  }, [profile, year, allEntries])
}
