import type { HandwerkerBeleg, UserProfile, WerbungskostenBeleg } from '../types/models'

/** MwSt-Satz der Referenz-Excel (Blatt "Handwerkerleistungen"). */
export const MWST_FAKTOR = 1.19

/** § 35a EStG: 20 % der Arbeitskosten, höchstens 1.200 € pro Jahr. */
export const HANDWERKER_ERMAESSIGUNG_SATZ = 0.2
export const HANDWERKER_ERMAESSIGUNG_MAX = 1200

/** Standardkategorie: Vorbelegung im Formular, Ziel beim Löschen anderer Kategorien, selbst nicht löschbar. */
export const STANDARD_KATEGORIE = 'Arbeitsmittel'

export const DEFAULT_WERBUNGSKOSTEN_KATEGORIEN = [STANDARD_KATEGORIE,'Büromaterial', 'Computer Zubehör']

/** Kategorien für `year`: eigener Eintrag, sonst vom letzten früheren Jahr mit Eintrag, sonst Standard. */
export function kategorienForYear(profile: UserProfile, year: number): string[] {
  const byYear = profile.werbungskostenKategorienByYear ?? {}
  const years = Object.keys(byYear)
    .map(Number)
    .filter((y) => y <= year)
    .sort((a, b) => b - a)
  const liste = years.length > 0 ? byYear[String(years[0])] : DEFAULT_WERBUNGSKOSTEN_KATEGORIEN
  // Die Standardkategorie ist immer vorhanden und steht vorn.
  return [STANDARD_KATEGORIE, ...liste.filter((k) => k !== STANDARD_KATEGORIE)]
}

export interface HandwerkerBerechnung {
  netto: number
  /** Arbeitskosten netto (Netto abzüglich Materialkosten). */
  handwerkerleistung: number
  /** Arbeitskosten inkl. MwSt — Grundlage der Steuerermäßigung. */
  handwerkerleistungBrutto: number
}

/** Formeln wie in der Excel: Netto = Brutto / 1,19; Handwerkerleistung = Netto - Material; zzgl. MwSt = * 1,19. */
export function berechneHandwerker(beleg: Pick<HandwerkerBeleg, 'rechnungsbetrag' | 'materialkosten'>): HandwerkerBerechnung {
  const netto = beleg.rechnungsbetrag / MWST_FAKTOR
  const handwerkerleistung = netto - beleg.materialkosten
  return { netto, handwerkerleistung, handwerkerleistungBrutto: handwerkerleistung * MWST_FAKTOR }
}

export interface HandwerkerSumme {
  rechnungsbetrag: number
  netto: number
  materialkosten: number
  handwerkerleistung: number
  handwerkerleistungBrutto: number
  /** 20 % der Arbeitskosten brutto, gedeckelt auf 1.200 €. */
  ermaessigung: number
}

export function summiereHandwerker(belege: HandwerkerBeleg[]): HandwerkerSumme {
  const sum: HandwerkerSumme = {
    rechnungsbetrag: 0,
    netto: 0,
    materialkosten: 0,
    handwerkerleistung: 0,
    handwerkerleistungBrutto: 0,
    ermaessigung: 0,
  }
  for (const b of belege) {
    const c = berechneHandwerker(b)
    sum.rechnungsbetrag += b.rechnungsbetrag
    sum.netto += c.netto
    sum.materialkosten += b.materialkosten
    sum.handwerkerleistung += c.handwerkerleistung
    sum.handwerkerleistungBrutto += c.handwerkerleistungBrutto
  }
  sum.ermaessigung = Math.min(
    Math.max(sum.handwerkerleistungBrutto, 0) * HANDWERKER_ERMAESSIGUNG_SATZ,
    HANDWERKER_ERMAESSIGUNG_MAX,
  )
  return sum
}

/** Monat (1-12) aus ISO-Datum YYYY-MM-DD. */
export function monatVon(reDatum: string): number {
  return Number(reDatum.slice(5, 7))
}

/** Summen je Monat (Index 1-12, Index 0 ungenutzt) über einen Wertgeber. */
export function summeJeMonat<T extends { reDatum: string }>(belege: T[], wert: (b: T) => number): number[] {
  const result = new Array<number>(13).fill(0)
  for (const b of belege) result[monatVon(b.reDatum)] += wert(b)
  return result
}

/** Summen je Kategorie, absteigend nach Betrag (entspricht der Pivot der Excel). */
export function summeJeKategorie(belege: WerbungskostenBeleg[]): { kategorie: string; betrag: number }[] {
  const map = new Map<string, number>()
  for (const b of belege) map.set(b.kategorie, (map.get(b.kategorie) ?? 0) + b.betrag)
  return [...map.entries()].map(([kategorie, betrag]) => ({ kategorie, betrag })).sort((a, b) => b.betrag - a.betrag)
}

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export function formatEuro(value: number): string {
  return EURO.format(value)
}

/** ISO YYYY-MM-DD -> TT.MM.JJJJ. */
export function formatDatum(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
