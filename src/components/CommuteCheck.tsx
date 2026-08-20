import { useState } from 'react'
import { geocodeAddress } from '../lib/geocoding'
import { calculateShortestDistanceKm } from '../lib/routing'

interface Props {
  homeAddress: string
  workAddress: string
  onApplyDistance: (km: number) => void
}

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'error'; message: string }
  | { status: 'success'; homeDisplayName: string; workDisplayName: string; distanceKm: number }

/**
 * Adressprüfung (OSM Nominatim) + kürzeste Wegstrecke (OSRM), Issue #61.
 * Bewusst ein expliziter Button statt Live-Autocomplete, siehe geocoding.ts.
 */
export function CommuteCheck({ homeAddress, workAddress, onApplyDistance }: Props) {
  const [state, setState] = useState<CheckState>({ status: 'idle' })

  const handleCheck = async () => {
    setState({ status: 'checking' })
    try {
      const [home, work] = await Promise.all([geocodeAddress(homeAddress), geocodeAddress(workAddress)])
      if (!home) {
        setState({ status: 'error', message: `Wohnadresse nicht gefunden: „${homeAddress}“` })
        return
      }
      if (!work) {
        setState({ status: 'error', message: `Arbeitsadresse nicht gefunden: „${workAddress}“` })
        return
      }
      const distanceKm = await calculateShortestDistanceKm(home, work)
      setState({ status: 'success', homeDisplayName: home.displayName, workDisplayName: work.displayName, distanceKm })
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const disabled = !homeAddress.trim() || !workAddress.trim() || state.status === 'checking'

  return (
    <div className="commute-check">
      <button type="button" className="btn btn-secondary" onClick={handleCheck} disabled={disabled}>
        {state.status === 'checking' ? 'Prüfe…' : 'Adressen prüfen & Wegstrecke berechnen'}
      </button>

      {state.status === 'error' && <p className="form-error">{state.message}</p>}

      {state.status === 'success' && (
        <div className="commute-check-result">
          <p className="form-hint" style={{ margin: 0 }}>
            Wohnadresse: {state.homeDisplayName}
            <br />
            Arbeitsadresse: {state.workDisplayName}
          </p>
          <p style={{ margin: 'var(--space-2) 0' }}>
            Kürzeste Strecke: <strong>{state.distanceKm.toFixed(1)} km</strong>
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onApplyDistance(Math.round(state.distanceKm * 10) / 10)}
          >
            Als Standard-Wegstrecke übernehmen
          </button>
        </div>
      )}
    </div>
  )
}
