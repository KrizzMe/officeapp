import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase/config'
import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { ProfileSetup } from './components/ProfileSetup'
import { ProfileEditor } from './components/ProfileEditor'
import { VacationTypesManager } from './components/VacationTypesManager'
import { ColorThemeEditor } from './components/ColorThemeEditor'
import { CalendarPage } from './components/CalendarPage'
import { YearOverview } from './components/YearOverview'
import { useEffect, useState } from 'react'
import { DEFAULT_COLOR_THEME } from './lib/colorThemes'

function App() {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading, reload } = useUserProfile(user?.uid)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'profile' | 'yearOverview' | null>(null)
  const editingProfile = activePanel === 'profile'
  const showYearOverview = activePanel === 'yearOverview'

  useEffect(() => {
    document.documentElement.dataset.theme = profile?.colorTheme ?? DEFAULT_COLOR_THEME
  }, [profile?.colorTheme])

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
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActivePanel((v) => (v === 'profile' ? null : 'profile'))}
            >
              {editingProfile ? 'Profil-Bearbeitung schließen' : 'Profil bearbeiten'}
            </button>
          )}
          {profile && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActivePanel((v) => (v === 'yearOverview' ? null : 'yearOverview'))}
            >
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
                  setActivePanel(null)
                  reload()
                }}
                onCancel={() => setActivePanel(null)}
              />
              <VacationTypesManager profile={profile} onUpdated={reload} />
              <ColorThemeEditor profile={profile} onSaved={reload} />
            </>
          )}
          {!editingProfile && showYearOverview && <YearOverview user={user} profile={profile} />}
          {!editingProfile && !showYearOverview && <CalendarPage user={user} profile={profile} />}
        </>
      ) : (
        <ProfileSetup user={user} onDone={reload} />
      )}
    </div>
  )
}

export default App
