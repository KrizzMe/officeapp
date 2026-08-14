import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider } from './firebase/config'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const login = async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <h1>Office App</h1>
      <p>Anwesenheits- &amp; Urlaubs-Tracker — Scaffold</p>

      {user ? (
        <div>
          <p>Angemeldet als {user.displayName} ({user.email})</p>
          <button onClick={() => signOut(auth)}>Abmelden</button>
        </div>
      ) : (
        <button onClick={login}>Mit Google anmelden</button>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}

export default App
