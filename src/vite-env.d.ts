/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** Beleg-Auslesung (Issue #79), optional: URL der Vercel-Funktion /api/extract-beleg. */
  readonly VITE_BELEG_API_URL?: string
  /** OneDrive-Ablage (Issue #79), optional: Client-ID der Microsoft-Entra-App-Registrierung. */
  readonly VITE_MS_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
