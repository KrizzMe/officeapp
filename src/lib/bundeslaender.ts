import type { Bundesland } from '../types/models'

export const BUNDESLAENDER: { code: Bundesland; name: string }[] = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
]

const BUNDESLAND_CODES: ReadonlySet<string> = new Set(BUNDESLAENDER.map((b) => b.code))

/**
 * Ordnet den von Nominatim gelieferten ISO3166-2-Code (z. B. "DE-BY") dem
 * Bundesland-Code zu. Zuverlässiger als der Freitext-Feldname "state", das
 * bei Stadtstaaten (Berlin, Hamburg, Bremen) von Nominatim gar nicht
 * geliefert wird, ISO3166-2-lvl4 aber schon.
 */
export function bundeslandFromIso(iso: string | undefined): Bundesland | undefined {
  const code = iso?.replace('DE-', '')
  return code && BUNDESLAND_CODES.has(code) ? (code as Bundesland) : undefined
}
