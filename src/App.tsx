import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase/config'
import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { ProfileSetup } from './components/ProfileSetup'
import { ProfileEditor } from './components/ProfileEditor'
import { VacationTypesManager } from './components/VacationTypesManager'
import { CalendarPage } from './components/CalendarPage'
import { YearOverview } from './components/YearOverview'
import { useState } from 'react'

function App() {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading, reload } = useUserProfile(user?.uid)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [showYearOverview, setShowYearOverview] = useState(false)

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
      <div className="login-screen">
        <div className="brand-mark" style={{ width: 56, height: 56, fontSize: '1.75rem' }}>
          📅
        </div>
        <h1>Office App</h1>
        <p>Anwesenheits- &amp; Urlaubs-Tracker</p>
        <button className="btn btn-primary" onClick={login}>
          Mit Google anmelden
        </button>
        {loginError && <p className="form-error">{loginError}</p>}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">📅</span>
          <h1>Office App</h1>
        </div>
        <div className="app-header-user">
          <span className="user-name">{user.displayName}</span>
          {profile && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditingProfile((v) => !v)}>
              {editingProfile ? 'Profil-Bearbeitung schließen' : 'Profil bearbeiten'}
            </button>
          )}
          {profile && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowYearOverview((v) => !v)}>
              {showYearOverview ? 'Jahresübersicht schließen' : 'Jahresübersicht'}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => signOut(auth)}>
            Abmelden
          </button>
        </div>
      </header>

      {profileLoading ? null : profile ? (
        <>
          {editingProfile && (
            <>
              <ProfileEditor
                profile={profile}
                onSaved={() => {
                  setEditingProfile(false)
                  reload()
                }}
                onCancel={() => setEditingProfile(false)}
              />
              <VacationTypesManager profile={profile} onUpdated={reload} />
            </>
          )}
          {showYearOverview && <YearOverview user={user} profile={profile} />}
          <CalendarPage user={user} profile={profile} />
        </>
      ) : (
        <ProfileSetup user={user} onDone={reload} />
      )}
    </div>
  )
}

export default App
