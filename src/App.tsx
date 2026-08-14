import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase/config'
import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { ProfileSetup } from './components/ProfileSetup'
import { ProfileEditor } from './components/ProfileEditor'
import { CalendarPage } from './components/CalendarPage'
import { useState } from 'react'

function App() {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading, reload } = useUserProfile(user?.uid)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)

  const login = async () => {
    setLoginError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err))
    }
  }

  if (authLoading) return null

  if (!user) {
    return (
      <div>
        <h1>Office App</h1>
        <p>Anwesenheits- &amp; Urlaubs-Tracker</p>
        <button onClick={login}>Mit Google anmelden</button>
        {loginError && <p style={{ color: 'red' }}>{loginError}</p>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Office App</h1>
        <div>
          <span>{user.displayName}</span>{' '}
          {profile && (
            <button onClick={() => setEditingProfile((v) => !v)}>
              {editingProfile ? 'Profil-Bearbeitung schließen' : 'Profil bearbeiten'}
            </button>
          )}{' '}
          <button onClick={() => signOut(auth)}>Abmelden</button>
        </div>
      </header>

      {profileLoading ? null : profile ? (
        <>
          {editingProfile && (
            <ProfileEditor
              profile={profile}
              onSaved={() => {
                setEditingProfile(false)
                reload()
              }}
              onCancel={() => setEditingProfile(false)}
            />
          )}
          <CalendarPage user={user} profile={profile} onProfileChange={reload} />
        </>
      ) : (
        <ProfileSetup user={user} onDone={reload} />
      )}
    </div>
  )
}

export default App
