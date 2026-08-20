/**
 * Datenmodell gemäß docs/projektbeschreibung-anwesenheits-app.md, Abschnitt 4.
 * Bewusst nicht 1:1 aus der Referenz-Excel übernommen — siehe Abschnitt 1 ("kein
 * strukturelles Nachbauen, sondern eigenes Datenmodell mit übernommener Berechnungslogik").
 */

/** Deutsche Bundesländer, für die automatische Feiertagszuordnung. */
export type Bundesland =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH'

/** Vom Nutzer wählbares Farbdesign (Issue #21). */
export type ColorTheme = 'lila' | 'rot-weiss' | 'gelb-gruen'

/** Vom Nutzer wählbarer Hell-/Dunkelmodus, unabhängig vom Farbdesign (Issue #41). */
export type ColorMode = 'hell' | 'dunkel' | 'automatisch'

/** Wochentag, für konfigurierbare Arbeitstage (Issue #34). */
export type Weekday = 'Mo' | 'Di' | 'Mi' | 'Do' | 'Fr' | 'Sa' | 'So'

/** Alle Wochentage in Kalenderreihenfolge, Montag zuerst. */
export const ALL_WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Default-Arbeitstage für Profile ohne explizite Angabe (Rückwärtskompatibilität, Issue #34). */
export const DEFAULT_ARBEITSTAGE: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

/**
 * Stabile leere Wochentagsliste für Profile ohne Homeoffice-Wochentage
 * (Issue #39) — referenzgleich über Re-Renders hinweg, damit `profile.homeofficeWeekdays ?? NO_WEEKDAYS`
 * keine useMemo-Abhängigkeiten unnötig invalidiert.
 */
export const NO_WEEKDAYS: readonly Weekday[] = []

/**
 * Zusätzlicher, arbeitgeberseitig arbeitsfreier Tag (z. B. durch
 * Betriebsvereinbarung, Issue #37) — wiederkehrend jedes Jahr am selben
 * Tag+Monat, wie gesetzliche Feiertage. `tag` im Format "MM-DD" (z. B.
 * "12-24" für 24.12.), abgleichbar mit dem entsprechenden Suffix eines
 * ISO-Datums (toIsoDate(date).slice(5)).
 */
export interface AgFreierTag {
  id: string
  tag: string
  bezeichnung: string
}

/** Stabile leere Liste für Profile ohne AG-freie Tage (Issue #37), analog zu NO_WEEKDAYS. */
export const NO_AG_FREIE_TAGE: readonly AgFreierTag[] = []

/** Rhythmus-Regel für Urlaubsarten mit Kontingent-Einschränkung (z. B. Dispositionstage). */
export interface VacationTypeRhythm {
  /** z. B. "quarterly" für "1 Tag pro Quartal". Weitere Rhythmen bei Bedarf ergänzen. */
  kind: 'quarterly'
  maxPerPeriod: number
}

/** Vom Nutzer frei definierte Urlaubsart (Abschnitt 4.3). */
export interface VacationType {
  id: string
  name: string
  /** Gesamtkontingent in Tagen pro Jahr. */
  totalDays: number
  rhythm?: VacationTypeRhythm
}

/** Nutzerprofil, einmalig gepflegt (Abschnitt 4.1). Firestore: users/{uid}. */
export interface UserProfile {
  uid: string
  displayName: string
  homeAddress: string
  workAddress: string
  /** Standard-Wegstrecke Wohnadresse -> Arbeitsadresse in km. Pro Tag überschreibbar (DayEntry.distanceKm). */
  defaultCommuteDistanceKm: number
  bundesland: Bundesland
  /**
   * Vom Nutzer gewähltes Farbdesign. Optional für Rückwärtskompatibilität mit
   * Profilen aus der Zeit vor Issue #21 — beim Fehlen gilt 'lila' als Default.
   */
  colorTheme?: ColorTheme
  /**
   * Vom Nutzer gewählter Hell-/Dunkelmodus (Issue #41). 'automatisch' folgt
   * der Betriebssystem-/Browser-Einstellung. Optional für Rückwärtskompatibilität
   * mit Profilen von vor diesem Feature; beim Fehlen gilt 'automatisch' als
   * Default (bisheriges Verhalten unverändert).
   */
  colorMode?: ColorMode
  /**
   * Ob der Status 'homeoffice' im Kalender überhaupt auswählbar ist (manche
   * Tätigkeiten erlauben kein Homeoffice). Optional für Rückwärtskompatibilität
   * mit Profilen von vor diesem Feature — beim Fehlen gilt true (erlaubt).
   */
  homeofficeErlaubt?: boolean
  /**
   * Vom Arbeitgeber vorgegebene Homeoffice-Obergrenze in Prozent der
   * möglichen Arbeitstage (Büro + Homeoffice + Dienstreise). Bestimmt die
   * geforderte Mindest-Anwesenheitsquote (100 - homeofficeQuote), individuell
   * pro Nutzer statt fest im Code (Abschnitt 5.1). Optional — beim Fehlen
   * gilt 60 (bisherige feste 40/60-Regel als Default).
   */
  homeofficeQuote?: number
  /**
   * An welchen Wochentagen der Nutzer arbeitet (Issue #34). Bestimmt, welche
   * Tage im Kalender als arbeitsfrei gelten statt fest Samstag/Sonntag
   * anzunehmen — z. B. für Teilzeitkräfte mit Arbeitstagen Do-So. Optional
   * für Rückwärtskompatibilität mit Profilen von vor diesem Feature; beim
   * Fehlen gilt Mo-Fr (DEFAULT_ARBEITSTAGE).
   */
  arbeitstage?: Weekday[]
  /**
   * An welchen Wochentagen der Nutzer in der Regel im Homeoffice ist (Issue
   * #39), sofern homeofficeErlaubt = true. Nur eine Teilmenge von arbeitstage
   * sinnvoll auswählbar — an arbeitsfreien Tagen kann kein Homeoffice
   * vorbelegt werden. Dient als Vorbelegung für Tage in zukünftigen Monaten
   * ohne expliziten Eintrag: effectiveDayStatus() liefert dafür 'homeoffice'
   * statt 'buero' (Fallback, Abschnitt 5.2). Wirkt nie auf den aktuellen oder
   * vergangene Monate, da die Berechnung strikt datumsbasiert ist — keine
   * Firestore-Schreibvorgänge nötig. Optional; beim
   * Fehlen gilt eine leere Auswahl (keine Vorbelegung, Fallback bleibt 'buero').
   */
  homeofficeWeekdays?: Weekday[]
  /**
   * Zusätzliche, arbeitgeberseitig arbeitsfreie Tage (Issue #37, z. B. durch
   * Betriebsvereinbarung wie 24.12./31.12.), zentral im Profil gepflegt statt
   * pro Jahr neu einzutragen. Werden wie gesetzliche Feiertage behandelt:
   * nicht manuell überschreibbar, zählen nicht zur Anwesenheitsquote (siehe
   * effectiveDayStatus()). Optional; beim Fehlen gilt eine leere Liste.
   */
  agFreieTage?: AgFreierTag[]
  /**
   * Urlaubsarten inkl. Regelurlaub und Resturlaub aus dem Vorjahr — beides
   * sind laut Abschnitt 4.2 selbst Beispiele für Urlaubsarten, kein
   * Sonderfall. Beim Onboarding vorbelegt mit den IDs 'urlaub' und
   * 'resturlaub', danach frei um weitere Arten ergänzbar (Abschnitt 4.3).
   */
  vacationTypes: VacationType[]
}

/** Feste, nicht vom Nutzer konfigurierbare Basis-Status (Abschnitt 4.2). */
export type BaseDayStatus = 'buero' | 'homeoffice' | 'dienstreise' | 'krank' | 'kind-krank'

/** IDs der beim Onboarding vorbelegten Urlaubsarten (siehe UserProfile.vacationTypes). */
export const DEFAULT_VACATION_TYPE_IDS = {
  urlaub: 'urlaub',
  resturlaub: 'resturlaub',
} as const

/**
 * Status eines Tages: einer der festen Basis-Status oder die id einer
 * nutzerdefinierten VacationType. Ersetzt die bisherigen zwei getrennten
 * Excel-Felder (Homeoffice-Flag + Abwesenheits-Dropdown) durch ein Feld.
 */
export type DayStatus = BaseDayStatus | string

/**
 * Ein Kalendereintrag pro Tag und Nutzer. Firestore: users/{uid}/days/{YYYY-MM-DD}.
 * Tage ohne Eintrag gelten an Werktagen automatisch als `buero` mit der
 * Standard-Wegstrecke (Fallback-Logik, Abschnitt 5.2) — es muss nicht für
 * jeden Werktag ein Dokument angelegt werden, nur für Ausnahmen.
 */
export interface DayEntry {
  /** ISO-Datum YYYY-MM-DD, dient zugleich als Dokument-ID. */
  date: string
  status: DayStatus
  /**
   * Wegstrecke in km für diesen Tag, nur relevant bei status 'buero' oder
   * 'dienstreise'. Überschreibt UserProfile.defaultCommuteDistanceKm, falls gesetzt.
   */
  distanceKm?: number
  /**
   * Optionaler Freitext-Grund bei 'dienstreise'/'krank'/'kind-krank' (Issue #33),
   * editierbar in der Jahresübersicht. Wird beim Speichern für alle Tage eines
   * zusammenhängenden Zeitraums gleichgesetzt.
   */
  grund?: string
}

/** Ergebnis der 40/60-Anwesenheitsquoten-Berechnung (Abschnitt 5.1) für einen Zeitraum. */
export interface AttendanceQuota {
  officeDays: number
  homeofficeDays: number
  businessTripDays: number
  /** officeDays + homeofficeDays + businessTripDays. */
  possibleWorkDays: number
  /** (officeDays + businessTripDays) / possibleWorkDays. */
  ratio: number
  /** Geforderte Mindestquote (1 - UserProfile.homeofficeQuote / 100), siehe requiredOfficeRatio(). */
  requiredOfficeRatio: number
  /** ratio >= requiredOfficeRatio */
  meetsThreshold: boolean
}

/** Verbleibende Tage je Urlaubsart plus Gesamtsumme (Abschnitt 5.4). */
export interface VacationBalance {
  vacationTypeId: string
  totalDays: number
  usedDays: number
  remainingDays: number
}
