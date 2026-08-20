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
  /** Von Nominatim normalisierte, vollständige Adresse — zur Bestätigung gegenüber dem Nutzer. */
  displayName: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

/** Liefert die erste Treffer-Adresse für `address`, oder `null` wenn nichts gefunden wurde. */
export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  const url = new URL(NOMINATIM_SEARCH_URL)
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Adressprüfung fehlgeschlagen (${response.status})`)
  }

  const results = (await response.json()) as NominatimResult[]
  const first = results[0]
  if (!first) return null

  return { lat: Number(first.lat), lon: Number(first.lon), displayName: first.display_name }
}
