import type { AgFreierTag, ArbeitsBlock, Bundesland, DayEntry, UserProfile, Weekday } from '../types/models'
import { DEFAULT_ARBEITSTAGE, NO_AG_FREIE_TAGE } from '../types/models'
import { getYearDays, toIsoDate } from './dates'
import { effectiveDayStatus } from './attendance'

/*
 * Arbeitszeiterfassung und Überstunden-Saldo (Issue #83). Alle Dauern in
 * ganzen Minuten, damit Summen nicht durch Gleitkomma-Rundung abdriften.
 */

/**
 * Arbeitszeit eines Tages: Arbeitsblöcke oder (CR 3) nur eine Stundenzahl
 * (`stundenMin`, dann ist `bloecke` leer), plus optional selbst eingetragene Pause.
 */
export interface Arbeitszeit {
  bloecke: ArbeitsBlock[]
  stundenMin?: number
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

/** Minuten seit Mitternacht → "HH:MM". */
export function formatUhrzeit(min: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

/**
 * Arbeitszeit eines Tageseintrags, sofern Blöcke erfasst sind. Einträge im
 * Altformat (nur `beginn`/`ende`) werden als ein Block gelesen.
 */
export function arbeitszeitOf(
  entry: Pick<DayEntry, 'bloecke' | 'beginn' | 'ende' | 'stundenMin' | 'pauseMin'> | undefined,
): Arbeitszeit | undefined {
  if (!entry) return undefined
  if (entry.stundenMin !== undefined && entry.stundenMin > 0) {
    return { bloecke: [], stundenMin: entry.stundenMin, pauseMin: entry.pauseMin }
  }
  const bloecke = entry.bloecke?.length
    ? entry.bloecke
    : entry.beginn && entry.ende
      ? [{ beginn: entry.beginn, ende: entry.ende }]
      : undefined
  if (!bloecke) return undefined
  return { bloecke, pauseMin: entry.pauseMin }
}

/** Ob der letzte Block noch läuft (Beginn gestempelt, Ende noch nicht). */
export function hatOffenenBlock(zeit: Arbeitszeit | undefined): boolean {
  return !!zeit && zeit.bloecke.length > 0 && !zeit.bloecke[zeit.bloecke.length - 1].ende
}

/** Gesetzliche Mindestpause für eine Anwesenheitsdauer (volle 30/45 Min., ohne Kappung). */
export function gesetzlichePauseMin(anwesendMin: number): number {
  return PAUSE_REGELN.find((r) => anwesendMin > r.abMin)?.pauseMin ?? 0
}

/**
 * Prüft die Blöcke eines Tages: gültige Uhrzeiten, Ende nach Beginn,
 * aufsteigend und ohne Überschneidung, höchstens der letzte Block offen.
 * Liefert eine Fehlermeldung oder `null`.
 */
export function pruefeBloecke(bloecke: ArbeitsBlock[], offenErlaubt: boolean): string | null {
  if (bloecke.length === 0) return 'Bitte mindestens einen Arbeitsblock angeben.'
  let vorherEnde = -1
  for (let i = 0; i < bloecke.length; i++) {
    const nr = bloecke.length > 1 ? ` (Block ${i + 1})` : ''
    const beginn = parseUhrzeit(bloecke[i].beginn)
    if (beginn === null) return `Bitte einen gültigen Beginn angeben${nr}.`
    if (beginn < vorherEnde) return `Die Blöcke dürfen sich nicht überschneiden${nr}.`
    if (!bloecke[i].ende) {
      if (i < bloecke.length - 1 || !offenErlaubt) return `Bitte ein Ende angeben${nr}.`
      return null
    }
    const ende = parseUhrzeit(bloecke[i].ende)
    if (ende === null) return `Bitte ein gültiges Ende angeben${nr}.`
    if (ende <= beginn) return `Das Ende muss nach dem Beginn liegen${nr}.`
    vorherEnde = ende
  }
  return null
}

/** Blöcke nach Beginn sortiert (für die Eingabe in beliebiger Reihenfolge). */
export function sortiereBloecke(bloecke: ArbeitsBlock[]): ArbeitsBlock[] {
  return [...bloecke].sort((a, b) => (parseUhrzeit(a.beginn) ?? 0) - (parseUhrzeit(b.beginn) ?? 0))
}

export interface NettoArbeitszeit {
  /** Beginn des ersten bis Ende des letzten Blocks. */
  anwesendMin: number
  /** Lücken zwischen den Blöcken (keine Arbeitszeit). */
  lueckenMin: number
  /** Selbst eingetragene Pause. */
  eigenePauseMin: number
  /** Zusätzlich abgezogen, weil Lücken + eigene Pause die gesetzliche Mindestpause nicht erreichen. */
  zusatzPauseMin: number
  /** Ob die gesetzliche Mindestpause einen zusätzlichen Abzug ausgelöst hat (Hinweis in der Eingabe). */
  gesetzlichAngewendet: boolean
  nettoMin: number
}

/**
 * Netto-Arbeitszeit eines Tages: Summe der Blöcke abzüglich eigener Pause;
 * Lücken + eigene Pause werden bei Bedarf auf die gesetzliche Mindestpause
 * (bemessen an der Anwesenheit) aufgefüllt. Ein offener letzter Block zählt
 * bis `offenBisMin` (laufender Tag), ohne diesen Wert ist das Ergebnis `null`.
 * Ebenfalls `null` bei ungültigen Blöcken.
 */
export function berechneNetto(zeit: Arbeitszeit, offenBisMin?: number): NettoArbeitszeit | null {
  const eigenePauseMin = Math.max(0, Math.round(zeit.pauseMin ?? 0))

  if (zeit.stundenMin !== undefined) {
    // Nur Stunden (CR 3): wie ein einzelner Block der Länge stundenMin.
    const anwesendMin = Math.round(zeit.stundenMin)
    if (!(anwesendMin > 0)) return null
    const zusatzPauseMin = Math.max(0, gesetzlichePauseMin(anwesendMin) - eigenePauseMin)
    return {
      anwesendMin,
      lueckenMin: 0,
      eigenePauseMin,
      zusatzPauseMin,
      gesetzlichAngewendet: zusatzPauseMin > 0,
      nettoMin: Math.max(0, anwesendMin - eigenePauseMin - zusatzPauseMin),
    }
  }

  const offen = hatOffenenBlock(zeit)
  if (offen && offenBisMin === undefined) return null
  if (pruefeBloecke(zeit.bloecke, offen) !== null) return null

  const spannen = zeit.bloecke.map((b) => {
    const beginn = parseUhrzeit(b.beginn) as number
    const ende = b.ende ? (parseUhrzeit(b.ende) as number) : Math.max(beginn, offenBisMin as number)
    return { beginn, ende }
  })
  const summeMin = spannen.reduce((sum, s) => sum + (s.ende - s.beginn), 0)
  const anwesendMin = spannen[spannen.length - 1].ende - spannen[0].beginn
  const lueckenMin = anwesendMin - summeMin
  const zusatzPauseMin = Math.max(0, gesetzlichePauseMin(anwesendMin) - lueckenMin - eigenePauseMin)
  return {
    anwesendMin,
    lueckenMin,
    eigenePauseMin,
    zusatzPauseMin,
    gesetzlichAngewendet: zusatzPauseMin > 0,
    nettoMin: Math.max(0, summeMin - eigenePauseMin - zusatzPauseMin),
  }
}

/**
 * Kleinste Anwesenheit (für „Nur Stunden“), die nach Abzug der gesetzlichen
 * Mindestpause genau `nettoMin` ergibt, z. B. 7:36 h → 8:06 h (CR 3, „Monat mit Soll füllen“).
 */
export function anwesenheitFuerNetto(nettoMin: number): number {
  for (const pause of [0, 30, 45]) {
    const anwesend = nettoMin + pause
    if (gesetzlichePauseMin(anwesend) <= pause) return anwesend
  }
  return nettoMin + 45
}

/** Eingabe einer Dauer ("7:30", "7,5") → Minuten, `null` bei ungültiger oder nicht positiver Eingabe. */
export function parseDauer(value: string): number | null {
  if (/^\s*[+\-−]/.test(value)) return null
  const min = parseSaldo(value)
  return min !== null && min > 0 ? min : null
}

/*
 * Stempeln auf dem Dashboard: Beginn wird auf 5 Min. abgerundet und dann
 * 5 Min. früher gebucht, Ende auf 5 Min. aufgerundet und dann 5 Min. später
 * (Weg Tiefgarage ↔ Arbeitsplatz zählt als Arbeitszeit). 8:21 → 8:15, 17:44 → 17:50.
 */
export function stempelBeginnMin(jetzt: Date): number {
  const min = jetzt.getHours() * 60 + jetzt.getMinutes()
  return Math.max(0, Math.floor(min / 5) * 5 - 5)
}

export function stempelEndeMin(jetzt: Date): number {
  const min = jetzt.getHours() * 60 + jetzt.getMinutes()
  return Math.min(23 * 60 + 59, Math.ceil(min / 5) * 5 + 5)
}

/** Minuten seit Mitternacht von `date`. */
export function minutenSeitMitternacht(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * Feierabend-Prognose bei laufendem Block: frühester Klick auf „Ende“ (ab
 * jetzt, minutengenau), mit dem das Tagessoll inkl. Pausenabzug und
 * Ende-Rundung erreicht ist. `null`, wenn heute nicht mehr erreichbar.
 */
export function feierabendPrognose(
  zeit: Arbeitszeit,
  sollMin: number,
  jetzt: Date,
): { klickMin: number; gebuchtMin: number } | null {
  if (!hatOffenenBlock(zeit)) return null
  for (let klick = minutenSeitMitternacht(jetzt); klick < 24 * 60; klick++) {
    const gebucht = Math.min(23 * 60 + 59, Math.ceil(klick / 5) * 5 + 5)
    const netto = berechneNetto(zeit, gebucht)
    if (netto && netto.nettoMin >= sollMin) return { klickMin: klick, gebuchtMin: gebucht }
  }
  return null
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

/**
 * Vergangene Büro-/Homeoffice-Tage ganz ohne Zeiten (CR 3, „Monat mit Soll
 * füllen“). Tage mit offenem Block („Ende fehlt“) zählen nicht dazu.
 */
export function tageOhneZeiten(days: Date[], entries: Map<string, DayEntry>, ctx: ArbeitszeitKontext): Date[] {
  return days.filter(
    (date) => tagesSaldoFuer(date, entries, ctx).art === 'fehlt' && !arbeitszeitOf(entries.get(toIsoDate(date))),
  )
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
