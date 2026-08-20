/**
 * Adressvalidierung/Geocoding über OpenStreetMap Nominatim (kostenlose,
 * öffentliche API). Nutzungsrichtlinie beachten:
 * https://operations.osmfoundation.org/policies/nominatim/ — max. 1
 * Request/Sekunde pro Quell-IP, kein automatisiertes Bulk-Geocoding. Deshalb
 * wird die Adressprüfung im UI bewusst über einen expliziten "Prüfen"-Button
 * ausgelöst statt live während der Eingabe (Issue #61).
 */

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

export interface GeocodedAddress {
  lat: number
  lon: number
  /** Straße + Hausnummer, wie von Nominatim normalisiert. */
  street: string
  postalCode: string
  city: string
  /** ISO3166-2-Code des Bundeslands laut Nominatim (z. B. "DE-BY"), siehe bundeslandFromIso(). */
  bundeslandIso?: string
  /** Vorformatierter Text für Anzeige/Auswahllisten: "Straße Hausnummer, PLZ Ort". */
  displayLabel: string
}

interface NominatimResult {
  lat: string
  lon: string
  address?: {
    road?: string
    house_number?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    'ISO3166-2-lvl4'?: string
  }
}

function toGeocodedAddress(result: NominatimResult): GeocodedAddress | null {
  const addr = result.address
  if (!addr) return null

  const street = [addr.road, addr.house_number].filter(Boolean).join(' ')
  const postalCode = addr.postcode ?? ''
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? ''
  if (!street || !postalCode || !city) return null

  return {
    lat: Number(result.lat),
    lon: Number(result.lon),
    street,
    postalCode,
    city,
    bundeslandIso: addr['ISO3166-2-lvl4'],
    displayLabel: `${street}, ${postalCode} ${city}`,
  }
}

async function searchNominatim(street: string, postalCode: string, city: string): Promise<GeocodedAddress[]> {
  const url = new URL(NOMINATIM_SEARCH_URL)
  url.searchParams.set('street', street)
  if (postalCode) url.searchParams.set('postalcode', postalCode)
  url.searchParams.set('city', city)
  url.searchParams.set('country', 'Deutschland')
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '5')

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Adressprüfung fehlgeschlagen (${response.status})`)
  }

  const results = (await response.json()) as NominatimResult[]
  const candidates = results.map(toGeocodedAddress).filter((c): c is GeocodedAddress => c !== null)

  const uniqueByAddress = new Map(candidates.map((c) => [`${c.street}|${c.postalCode}|${c.city}`, c]))
  return [...uniqueByAddress.values()]
}

/**
 * Sucht Adresskandidaten für eine Adresse (Straße+Hausnummer, Ort, PLZ
 * optional). Die PLZ ist bei Nominatim ein harter Filter — ein Tippfehler
 * oder eine nicht exakt indexierte PLZ liefert sonst null Treffer, obwohl
 * Straße+Ort eindeutig wären. Deshalb: mit PLZ suchen, bei null Treffern
 * automatisch ohne PLZ erneut versuchen.
 *
 * Mehrere Kandidaten mit identischer Straße/PLZ/Ort (z. B. mehrere
 * Gebäudeeinträge derselben Anschrift) werden zu einem zusammengefasst —
 * als "mehrdeutig" gilt nur eine wirklich abweichende Adresse.
 */
export async function searchAddressCandidates(
  street: string,
  postalCode: string,
  city: string,
): Promise<GeocodedAddress[]> {
  const results = await searchNominatim(street, postalCode, city)
  if (results.length > 0 || !postalCode) return results
  return searchNominatim(street, '', city)
}
