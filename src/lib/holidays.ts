import type { Bundesland } from '../types/models'
import { toIsoDate } from './dates'

/**
 * Gauß'sche Osterformel (gregorianisch). Liefert das Datum des Ostersonntags,
 * konsequent in lokaler Zeit (Mitternacht), passend zu den übrigen
 * Kalender-Utilities in dates.ts — keine UTC-Vermischung.
 */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Buß- und Bettag: Mittwoch vor dem 23. November. */
function bussUndBettag(year: number): Date {
  const nov23 = new Date(year, 10, 23)
  const weekday = nov23.getDay() // 0 = Sonntag
  const offsetToWednesday = (weekday - 3 + 7) % 7 || 7
  return addDays(nov23, -offsetToWednesday)
}

/** Gesetzliche Feiertage für ein Bundesland in einem Jahr. Key: ISO-Datum, Value: Name. */
export function getHolidays(year: number, bundesland: Bundesland): Map<string, string> {
  const easter = easterSunday(year)
  const holidays = new Map<string, string>()

  const set = (date: Date, name: string) => holidays.set(toIsoDate(date), name)

  // Bundesweit
  set(new Date(year, 0, 1), 'Neujahr')
  set(addDays(easter, -2), 'Karfreitag')
  set(addDays(easter, 1), 'Ostermontag')
  set(new Date(year, 4, 1), 'Tag der Arbeit')
  set(addDays(easter, 39), 'Christi Himmelfahrt')
  set(addDays(easter, 50), 'Pfingstmontag')
  set(new Date(year, 9, 3), 'Tag der Deutschen Einheit')
  set(new Date(year, 11, 25), '1. Weihnachtsfeiertag')
  set(new Date(year, 11, 26), '2. Weihnachtsfeiertag')

  const heiligeDreiKoenige = () => set(new Date(year, 0, 6), 'Heilige Drei Könige')
  const fronleichnam = () => set(addDays(easter, 60), 'Fronleichnam')
  const mariaeHimmelfahrt = () => set(new Date(year, 7, 15), 'Mariä Himmelfahrt')
  const allerheiligen = () => set(new Date(year, 10, 1), 'Allerheiligen')
  const reformationstag = () => set(new Date(year, 9, 31), 'Reformationstag')
  const frauentag = () => set(new Date(year, 2, 8), 'Internationaler Frauentag')

  switch (bundesland) {
    case 'BW':
      heiligeDreiKoenige(); fronleichnam(); allerheiligen()
      break
    case 'BY':
      heiligeDreiKoenige(); fronleichnam(); mariaeHimmelfahrt(); allerheiligen()
      break
    case 'BE':
      frauentag()
      break
    case 'BB':
      reformationstag()
      break
    case 'HB':
      reformationstag()
      break
    case 'HH':
      reformationstag()
      break
    case 'HE':
      fronleichnam()
      break
    case 'MV':
      reformationstag(); frauentag()
      break
    case 'NI':
      reformationstag()
      break
    case 'NW':
      fronleichnam(); allerheiligen()
      break
    case 'RP':
      fronleichnam(); allerheiligen()
      break
    case 'SL':
      fronleichnam(); mariaeHimmelfahrt(); allerheiligen()
      break
    case 'SN':
      reformationstag(); set(bussUndBettag(year), 'Buß- und Bettag')
      break
    case 'ST':
      heiligeDreiKoenige(); reformationstag()
      break
    case 'SH':
      reformationstag()
      break
    case 'TH':
      reformationstag(); set(new Date(year, 8, 20), 'Weltkindertag')
      break
  }

  return holidays
}

/** Feiertagsname für ein Datum, falls es einer ist. */
export function getHolidayName(date: Date, bundesland: Bundesland): string | undefined {
  return getHolidays(date.getFullYear(), bundesland).get(toIsoDate(date))
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}
