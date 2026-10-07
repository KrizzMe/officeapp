import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * Für Anmeldung und Firestore zwingend nötige Variablen (Issue #65). Fehlt
 * eine davon im Build — z. B. ein nicht gesetztes GitHub-Secret —, entstand
 * bisher ein Artefakt, das sich erst zur Laufzeit mit einem unspezifischen
 * Firebase-Fehler meldete. Hier gibt es dafür eine klare Meldung, die die
 * fehlende Variable benennt.
 *
 * `storageBucket` und `messagingSenderId` sind absichtlich nicht dabei: sie
 * werden von Auth/Firestore nicht gebraucht und sollen einen ansonsten
 * funktionierenden Build nicht verhindern.
 */
const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const

const missing = REQUIRED_KEYS.filter((key) => !firebaseConfig[key])
if (missing.length > 0) {
  const envNames = missing.map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`)
  throw new Error(
    `Firebase-Konfiguration unvollständig — folgende Umgebungsvariablen fehlen oder sind leer: ${envNames.join(', ')}. ` +
      'Siehe .env.example bzw. die Repository-Secrets der Deploy-Workflows.',
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
