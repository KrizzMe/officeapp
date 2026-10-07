import { useEffect, useState } from 'react'
import type { UserProfile } from '../types/models'
import { getUserProfile } from '../firebase/firestore'

/**
 * Lädt das Profil eines eingeloggten Nutzers einmalig. `null` = kein Profil vorhanden (Onboarding nötig).
 *
 * `error` ist bewusst von `profile === null` getrennt (Issue #65): ein
 * fehlgeschlagener Ladevorgang (offline, Rechtefehler) darf nicht wie "noch
 * kein Profil vorhanden" behandelt werden, sonst zeigt die App einem Nutzer
 * mit bestehendem Profil das Onboarding und legt es anschließend neu an.
 */
export function useUserProfile(uid: string | undefined): {
  profile: UserProfile | null
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!uid) {
      setProfile(null)
      setError(null)
      setLoading(false)
      return
    }
    // Verhindert, dass die Antwort eines überholten Ladevorgangs (Nutzerwechsel
    // oder schnelles reload()) einen neueren Stand überschreibt.
    let cancelled = false
    setLoading(true)
    setError(null)
    getUserProfile(uid)
      .then((p) => {
        if (cancelled) return
        setProfile(p)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [uid, reloadToken])

  return { profile, loading, error, reload: () => setReloadToken((t) => t + 1) }
}
