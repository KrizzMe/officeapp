import { useEffect, useState } from 'react'
import type { UserProfile } from '../types/models'
import { getUserProfile } from '../firebase/firestore'

/** Lädt das Profil eines eingeloggten Nutzers einmalig. `null` = kein Profil vorhanden (Onboarding nötig). */
export function useUserProfile(uid: string | undefined): {
  profile: UserProfile | null
  loading: boolean
  reload: () => void
} {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!uid) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    getUserProfile(uid).then((p) => {
      setProfile(p)
      setLoading(false)
    })
  }, [uid, reloadToken])

  return { profile, loading, reload: () => setReloadToken((t) => t + 1) }
}
