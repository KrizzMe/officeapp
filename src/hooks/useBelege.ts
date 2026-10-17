import { useEffect, useState } from 'react'
import type { HandwerkerBeleg, WerbungskostenBeleg } from '../types/models'
import { subscribeHandwerkerYear, subscribeWerbungskostenYear } from '../firebase/firestore'

interface BelegState<T> {
  belege: T[]
  loading: boolean
  error: string | null
}

function useBelege<T>(
  uid: string | undefined,
  year: number,
  subscribe: (
    uid: string,
    year: number,
    onData: (belege: T[]) => void,
    onError: (message: string) => void,
  ) => () => void,
): BelegState<T> {
  const [state, setState] = useState<BelegState<T>>({ belege: [], loading: true, error: null })

  useEffect(() => {
    if (!uid) return
    setState((s) => ({ ...s, loading: true, error: null }))
    return subscribe(
      uid,
      year,
      (belege) => setState({ belege, loading: false, error: null }),
      (error) => setState({ belege: [], loading: false, error }),
    )
  }, [uid, year, subscribe])

  return state
}

export function useHandwerkerBelege(uid: string | undefined, year: number) {
  return useBelege<HandwerkerBeleg>(uid, year, subscribeHandwerkerYear)
}

export function useWerbungskostenBelege(uid: string | undefined, year: number) {
  return useBelege<WerbungskostenBeleg>(uid, year, subscribeWerbungskostenYear)
}
