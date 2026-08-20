import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase/config'
import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { ProfileSetup } from './components/ProfileSetup'
import { ProfileEditor } from './components/ProfileEditor'
import { VacationTypesManager } from './components/VacationTypesManager'
import { AgFreieTageManager } from './components/AgFreieTageManager'
import { ColorThemeEditor } from './components/ColorThemeEditor'
import { CalendarPage } from './components/CalendarPage'
import { HomeDashboard } from './components/HomeDashboard'
import { YearOverview } from './components/YearOverview'
import { useEffect, useState } from 'react'
import { applyColorMode, applyColorTheme, DEFAULT_COLOR_MODE, DEFAULT_COLOR_THEME } from './lib/colorThemes'

type Panel = 'dashboard' | 'monthOverview' | 'yearOverview' | 'profile'

function App() {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading, reload } = useUserProfile(user?.uid)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<Panel>('dashboard')
  const editingProfile = activePanel === 'profile'

  useEffect(() => {
    applyColorTheme(profile?.colorTheme ?? DEFAULT_COLOR_THEME)
    applyColorMode(profile?.colorMode ?? DEFAULT_COLOR_MODE)
  }, [profile?.colorTheme, profile?.colorMode])

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
        <div className="app-header-top">
          <div className="brand">
            <span className="brand-mark">📅</span>
            <h1>Office App</h1>
          </div>
          <div className="app-header-user">
            <span className="user-name">{user.displayName}</span>
            {profile && (
              <button
                className={activePanel === 'profile' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => setActivePanel('profile')}
              >
                Profil bearbeiten
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => signOut(auth)}>
              Abmelden
            </button>
          </div>
        </div>
        {profile && (
          <nav className="app-header-nav">
            <button
              className={activePanel === 'dashboard' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => setActivePanel('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={activePanel === 'monthOverview' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => setActivePanel('monthOverview')}
            >
              Monatsübersicht
            </button>
            <button
              className={activePanel === 'yearOverview' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => setActivePanel('yearOverview')}
            >
              Jahresübersicht
            </button>
          </nav>
        )}
      </header>

      {profileLoading ? null : profile ? (
        <>
          {editingProfile && (
            <>
              <ProfileEditor
                profile={profile}
                onSaved={() => {
                  setActivePanel('dashboard')
                  reload()
                }}
                onCancel={() => setActivePanel('dashboard')}
              />
              <VacationTypesManager profile={profile} onUpdated={reload} />
              <AgFreieTageManager profile={profile} onUpdated={reload} />
              <ColorThemeEditor profile={profile} onSaved={reload} />
            </>
          )}
          {activePanel === 'yearOverview' && <YearOverview user={user} profile={profile} />}
          {activePanel === 'monthOverview' && <CalendarPage user={user} profile={profile} />}
          {activePanel === 'dashboard' && <HomeDashboard user={user} profile={profile} />}
        </>
      ) : (
        <ProfileSetup user={user} onDone={reload} />
      )}
    </div>
  )
}

export default App
