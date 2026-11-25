import type { AgFreierTag, Bundesland, DayEntry, UserProfile, Weekday } from '../types/models'
import { DEFAULT_ARBEITSTAGE, NO_AG_FREIE_TAGE } from '../types/models'
import { getYearDays, toIsoDate } from './dates'
import { effectiveDayStatus } from './attendance'

/*
 * Arbeitszeiterfassung und Überstunden-Saldo (Issue #83). Alle Dauern in
 * ganzen Minuten, damit Summen nicht durch Gleitkomma-Rundung abdriften.
 */

/** Zeitfelder eines Tageseintrags (DayEntry.beginn/ende/pauseMin). */
export interface Arbeitszeit {
  beginn: string
  ende: string
  pauseMin?: number
}

/** Ab mehr als 6 h Anwesenheit mindestens 30 Min., ab mehr als 9 h mindestens 45 Min. Pause (§ 4 ArbZG). */
const PAUSE_REGELN: readonly { abMin: number; pauseMin: number }[] = [
  { abMin: 9 * 60, pauseMin: 45 },
  { abMin: 6 * 60, pauseMin: 30 },
]

/** "HH:MM" → Minuten seit Mitternacht, `null` bei ungültiger Eingabe. */
export function parseUhrzeit(value: string | undefined): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** Zeitfelder eines Tageseintrags, sofern Beginn und Ende gesetzt sind. */
export function arbeitszeitOf(entry: DayEntry | undefined): Arbeitszeit | undefined {
  if (!entry?.beginn || !entry.ende) return undefined
  return { beginn: entry.beginn, ende: entry.ende, pauseMin: entry.pauseMin }
}

/** Gesetzliche Mindestpause für eine Anwesenheitsdauer (volle 30/45 Min., ohne Kappung). */
export function gesetzlichePauseMin(anwesendMin: number): number {
  return PAUSE_REGELN.find((r) => anwesendMin > r.abMin)?.pauseMin ?? 0
}

export interface NettoArbeitszeit {
  /** Ende − Beginn. */
  anwesendMin: number
  /** Tatsächlich abgezogene Pause: das Größere aus eigener und gesetzlicher Pause. */
  pauseMin: number
  /** Ob die gesetzliche Mindestpause die eigene Angabe übersteigt (Hinweis in der Eingabe). */
  gesetzlichAngewendet: boolean
  nettoMin: number
}

/**
 * Netto-Arbeitszeit eines Tages. `null`, wenn Beginn/Ende ungültig sind oder
 * das Ende nicht nach dem Beginn liegt (keine Schichten über Mitternacht).
 */
export function berechneNetto(zeit: Arbeitszeit): NettoArbeitszeit | null {
  const beginn = parseUhrzeit(zeit.beginn)
  const ende = parseUhrzeit(zeit.ende)
  if (beginn === null || ende === null || ende <= beginn) return null
  const anwesendMin = ende - beginn
  const eigenePause = Math.max(0, Math.round(zeit.pauseMin ?? 0))
  const gesetzlich = gesetzlichePauseMin(anwesendMin)
  const pauseMin = Math.min(anwesendMin, Math.max(eigenePause, gesetzlich))
  return {
    anwesendMin,
    pauseMin,
    gesetzlichAngewendet: gesetzlich > eigenePause,
    nettoMin: anwesendMin - pauseMin,
  }
}

/** Soll je Arbeitstag (Durchschnittstag) in Minuten, `null` ohne hinterlegte Wochenstunden. */
export function sollMinProTag(profile: Pick<UserProfile, 'wochenstunden' | 'arbeitstage'>): number | null {
  const wochenstunden = profile.wochenstunden
  const tage = (profile.arbeitstage ?? DEFAULT_ARBEITSTAGE).length
  if (!wochenstunden || wochenstunden <= 0 || tage === 0) return null
  return Math.round((wochenstunden * 60) / tage)
}

/** An welchen (effektiven) Status Zeiten erfasst werden können. */
export function istZeiterfassungsStatus(status: string): boolean {
  return status === 'buero' || status === 'homeoffice'
}

export type TagesArt =
  /** Zählt nicht (arbeitsfrei, zukünftig, heute noch ohne Zeiten). */
  | 'neutral'
  /** Pauschal als Durchschnittstag gutgeschrieben (Dienstreise, Urlaub, Krank, Feiertag, …). */
  | 'pauschal'
  /** Büro/Homeoffice mit erfassten Zeiten. */
  | 'erfasst'
  /** Vergangener Büro-/Homeoffice-Tag ohne Zeiten: 0 h Ist. */
  | 'fehlt'

export interface TagesSaldo {
  art: TagesArt
  sollMin: number
  istMin: number
  saldoMin: number
}

const NEUTRAL: TagesSaldo = { art: 'neutral', sollMin: 0, istMin: 0, saldoMin: 0 }

/**
 * Bewertung eines Tages fürs Überstunden-Saldo. `status` ist der effektive
 * Status aus effectiveDayStatus(). Strikt zukünftige Tage zählen nie, der
 * heutige Tag nur, wenn bereits Zeiten erfasst sind.
 */
export function tagesSaldo(
  date: Date,
  status: string,
  entry: DayEntry | undefined,
  sollMin: number,
  today: Date = new Date(),
): TagesSaldo {
  if (status === 'wochenende') return NEUTRAL
  const iso = toIsoDate(date)
  const todayIso = toIsoDate(today)
  if (iso > todayIso) return NEUTRAL

  if (!istZeiterfassungsStatus(status)) {
    return { art: 'pauschal', sollMin, istMin: sollMin, saldoMin: 0 }
  }

  const zeit = arbeitszeitOf(entry)
  const netto = zeit ? berechneNetto(zeit) : null
  if (netto) return { art: 'erfasst', sollMin, istMin: netto.nettoMin, saldoMin: netto.nettoMin - sollMin }
  if (iso === todayIso) return NEUTRAL
  return { art: 'fehlt', sollMin, istMin: 0, saldoMin: -sollMin }
}

export interface ArbeitszeitSumme {
  sollMin: number
  istMin: number
  saldoMin: number
  /** Vergangene Büro-/Homeoffice-Tage ohne Zeiten. */
  fehlendeTage: number
}

/** Kontext, der für die Bewertung aller Tage gleich bleibt. */
export interface ArbeitszeitKontext {
  bundesland: Bundesland
  agFreieTage: readonly AgFreierTag[]
  arbeitstage: readonly Weekday[]
  sollMin: number
  today?: Date
}

export function kontextAusProfil(profile: UserProfile, today?: Date): ArbeitszeitKontext | null {
  const sollMin = sollMinProTag(profile)
  if (sollMin === null) return null
  return {
    bundesland: profile.bundesland,
    agFreieTage: profile.agFreieTage ?? NO_AG_FREIE_TAGE,
    arbeitstage: profile.arbeitstage ?? DEFAULT_ARBEITSTAGE,
    sollMin,
    today,
  }
}

/** Saldo eines Tages inkl. Ermittlung des effektiven Status. */
export function tagesSaldoFuer(date: Date, entries: Map<string, DayEntry>, ctx: ArbeitszeitKontext): TagesSaldo {
  const entry = entries.get(toIsoDate(date))
  // Ohne homeofficeWeekdays: Büro und Homeoffice werden identisch bewertet.
  const status = effectiveDayStatus(date, ctx.bundesland, ctx.agFreieTage, entry, ctx.arbeitstage)
  return tagesSaldo(date, status, entry, ctx.sollMin, ctx.today)
}

/** Summe über eine Liste von Tagen (Monat oder Jahr). */
export function summiereArbeitszeit(
  days: Date[],
  entries: Map<string, DayEntry>,
  ctx: ArbeitszeitKontext,
): ArbeitszeitSumme {
  const summe: ArbeitszeitSumme = { sollMin: 0, istMin: 0, saldoMin: 0, fehlendeTage: 0 }
  for (const date of days) {
    const t = tagesSaldoFuer(date, entries, ctx)
    summe.sollMin += t.sollMin
    summe.istMin += t.istMin
    summe.saldoMin += t.saldoMin
    if (t.art === 'fehlt') summe.fehlendeTage++
  }
  return summe
}

/** Frühestes Jahr mit erfassten Zeiten, `undefined` wenn noch nie Zeiten erfasst wurden. */
export function erstesErfassungsjahr(allEntries: Map<string, DayEntry>): number | undefined {
  let first: number | undefined
  for (const entry of allEntries.values()) {
    if (!arbeitszeitOf(entry)) continue
    const year = Number(entry.date.slice(0, 4))
    if (first === undefined || year < first) first = year
  }
  return first
}

export interface Uebertrag {
  minuten: number
  manuell: boolean
}

/**
 * Überstunden-Übertrag ins Jahr `year`: der manuell gesetzte Wert
 * (UserProfile.arbeitszeitUebertragByYear) oder automatisch Übertrag +
 * Jahressaldo des Vorjahres, verkettet ab dem ersten Jahr mit erfassten
 * Zeiten. Jahre davor zählen nicht (App war noch nicht im Einsatz), das erste
 * Erfassungsjahr startet ohne manuellen Wert bei 0.
 */
export function berechneUebertrag(
  profile: UserProfile,
  year: number,
  allEntries: Map<string, DayEntry>,
  ctx: ArbeitszeitKontext,
): Uebertrag {
  const manuell = profile.arbeitszeitUebertragByYear ?? {}
  const own = manuell[String(year)]
  if (own !== undefined) return { minuten: own, manuell: true }

  const first = erstesErfassungsjahr(allEntries)
  if (first === undefined || year <= first) return { minuten: 0, manuell: false }

  let carry = manuell[String(first)] ?? 0
  for (let y = first; y < year; y++) {
    if (y > first && manuell[String(y)] !== undefined) carry = manuell[String(y)]
    carry += summiereArbeitszeit(getYearDays(y), allEntries, ctx).saldoMin
  }
  return { minuten: carry, manuell: false }
}

/** Dauer als "H:MM", z. B. 456 → "7:36". */
export function formatDauer(min: number): string {
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${min < 0 ? '−' : ''}${h}:${String(m).padStart(2, '0')}`
}

/** Saldo mit Vorzeichen, z. B. "+12:30" / "−3:15" / "±0:00". */
export function formatSaldo(min: number): string {
  const rounded = Math.round(min)
  if (rounded === 0) return '±0:00'
  return `${rounded > 0 ? '+' : ''}${formatDauer(rounded)}`
}

/**
 * Eingabe eines Saldos (Übertrag) → Minuten. Akzeptiert "12:30", "+12:30",
 * "-3:15", "−3:15" sowie Dezimalstunden wie "12,5". `null` bei ungültiger Eingabe.
 */
export function parseSaldo(value: string): number | null {
  const trimmed = value.trim().replace('−', '-').replace(/\s/g, '')
  if (!trimmed) return null
  const hm = /^([+-]?)(\d+):(\d{1,2})$/.exec(trimmed)
  if (hm) {
    const m = Number(hm[3])
    if (m > 59) return null
    const total = Number(hm[2]) * 60 + m
    return hm[1] === '-' ? -total : total
  }
  const dec = /^([+-]?)(\d+(?:[.,]\d+)?)$/.exec(trimmed)
  if (dec) {
    const total = Math.round(Number(dec[2].replace(',', '.')) * 60)
    return dec[1] === '-' ? -total : total
  }
  return null
}
