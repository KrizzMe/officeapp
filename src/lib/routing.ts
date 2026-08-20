/**
 * Kürzeste-Strecke-Berechnung über den öffentlichen OSRM-Demo-Server
 * (kostenlos, für geringes Anfragevolumen gedacht — siehe
 * https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server). Straßenrouting,
 * daher passend für einen Arbeitsweg mit dem Auto; für andere Verkehrsmittel
 * gibt der berechnete Wert nur eine Näherung.
 */

import type { GeocodedAddress } from './geocoding'

const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving'

interface OsrmRouteResponse {
  code: string
  routes?: Array<{ distance: number }>
}

/** Kürzeste Strecke zwischen zwei Koordinaten in km (Luftlinie ist es nicht — echte Route). */
export async function calculateShortestDistanceKm(from: GeocodedAddress, to: GeocodedAddress): Promise<number> {
  const url = `${OSRM_ROUTE_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Routenberechnung fehlgeschlagen (${response.status})`)
  }

  const data = (await response.json()) as OsrmRouteResponse
  const route = data.routes?.[0]
  if (data.code !== 'Ok' || !route) {
    throw new Error('Zwischen den beiden Adressen wurde keine Route gefunden.')
  }

  return route.distance / 1000
}
