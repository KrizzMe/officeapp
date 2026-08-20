import { useState } from 'react'
import type { GeocodedAddress } from '../lib/geocoding'
import { searchAddressCandidates } from '../lib/geocoding'
import { calculateShortestDistanceKm } from '../lib/routing'
import { bundeslandFromIso } from '../lib/bundeslaender'
import type { Bundesland } from '../types/models'

export interface ResolvedAddress {
  street: string
  postalCode: string
  city: string
}

interface Props {
  homeStreet: string
  homePostalCode: string
  homeCity: string
  workStreet: string
  workPostalCode: string
  workCity: string
  onApplyHome: (address: ResolvedAddress, bundesland: Bundesland | undefined) => void
  onApplyWork: (address: ResolvedAddress) => void
  onShortestDistance: (km: number) => void
}

type SideResult =
  | { kind: 'resolved'; address: GeocodedAddress }
  | { kind: 'ambiguous'; candidates: GeocodedAddress[] }
  | { kind: 'not-found' }

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'error'; message: string }
  | { status: 'done'; home: SideResult; work: SideResult; routeError: string | null }

function toSideResult(candidates: GeocodedAddress[]): SideResult {
  if (candidates.length === 0) return { kind: 'not-found' }
  if (candidates.length === 1) return { kind: 'resolved', address: candidates[0] }
  return { kind: 'ambiguous', candidates }
}

/**
 * Adressprüfung (OSM Nominatim) + kürzeste Wegstrecke (OSRM), Issue #61.
 * Bewusst ein expliziter Button statt Live-Autocomplete, siehe geocoding.ts.
 * Bei eindeutigem Treffer werden Adresse (+ bei der Wohnadresse das
 * Bundesland) direkt normalisiert übernommen; bei mehreren Treffern wählt
 * der Nutzer aus einer Liste.
 */
export function CommuteCheck({
  homeStreet,
  homePostalCode,
  homeCity,
  workStreet,
  workPostalCode,
  workCity,
  onApplyHome,
  onApplyWork,
  onShortestDistance,
}: Props) {
  const [state, setState] = useState<CheckState>({ status: 'idle' })

  const applyHome = (address: GeocodedAddress) => {
    onApplyHome(
      { street: address.street, postalCode: address.postalCode, city: address.city },
      bundeslandFromIso(address.bundeslandIso),
    )
  }

  const applyWork = (address: GeocodedAddress) => {
    onApplyWork({ street: address.street, postalCode: address.postalCode, city: address.city })
  }

  const calculateRoute = async (home: GeocodedAddress, work: GeocodedAddress): Promise<string | null> => {
    try {
      const km = await calculateShortestDistanceKm(home, work)
      onShortestDistance(km)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }

  const runCheck = async () => {
    setState({ status: 'checking' })
    try {
      const [homeCandidates, workCandidates] = await Promise.all([
        searchAddressCandidates(homeStreet, homePostalCode, homeCity),
        searchAddressCandidates(workStreet, workPostalCode, workCity),
      ])
      const home = toSideResult(homeCandidates)
      const work = toSideResult(workCandidates)
      if (home.kind === 'resolved') applyHome(home.address)
      if (work.kind === 'resolved') applyWork(work.address)

      let routeError: string | null = null
      if (home.kind === 'resolved' && work.kind === 'resolved') {
        routeError = await calculateRoute(home.address, work.address)
      }
      setState({ status: 'done', home, work, routeError })
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const chooseCandidate = async (side: 'home' | 'work', address: GeocodedAddress) => {
    if (state.status !== 'done') return
    if (side === 'home') applyHome(address)
    else applyWork(address)

    const home = side === 'home' ? ({ kind: 'resolved', address } as const) : state.home
    const work = side === 'work' ? ({ kind: 'resolved', address } as const) : state.work

    let routeError: string | null = null
    if (home.kind === 'resolved' && work.kind === 'resolved') {
      routeError = await calculateRoute(home.address, work.address)
    }
    setState({ status: 'done', home, work, routeError })
  }

  const disabled =
    state.status === 'checking' || ![homeStreet, homeCity, workStreet, workCity].every((v) => v.trim())

  return (
    <div className="commute-check">
      <button type="button" className="btn btn-secondary" onClick={runCheck} disabled={disabled}>
        {state.status === 'checking' ? 'Prüfe…' : 'Adressen prüfen'}
      </button>

      {state.status === 'error' && <p className="form-error">{state.message}</p>}

      {state.status === 'done' && (
        <div className="commute-check-result">
          <AddressCheckRow label="Wohnadresse" result={state.home} onChoose={(a) => chooseCandidate('home', a)} />
          <AddressCheckRow label="Arbeitsadresse" result={state.work} onChoose={(a) => chooseCandidate('work', a)} />
          {state.routeError && <p className="form-error">{state.routeError}</p>}
        </div>
      )}
    </div>
  )
}

function AddressCheckRow({
  label,
  result,
  onChoose,
}: {
  label: string
  result: SideResult
  onChoose: (address: GeocodedAddress) => void
}) {
  if (result.kind === 'resolved') {
    return (
      <p className="form-hint" style={{ margin: 0 }}>
        {label}: {result.address.displayLabel} ✓
      </p>
    )
  }

  if (result.kind === 'not-found') {
    return <p className="form-error">{label} nicht gefunden. Bitte Eingabe prüfen.</p>
  }

  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <p className="form-warning" style={{ margin: 0 }}>
        {label}: mehrere Treffer, bitte auswählen:
      </p>
      <ul className="commute-check-candidates">
        {result.candidates.map((candidate) => (
          <li key={candidate.displayLabel}>
            <button type="button" className="btn btn-secondary" onClick={() => onChoose(candidate)}>
              {candidate.displayLabel}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
