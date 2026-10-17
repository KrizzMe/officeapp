/**
 * OneDrive-Ablage für Belege (Issue #79) über Microsoft Graph + MSAL.js.
 *
 * Privates Microsoft-Konto, Login per Popup. Scope `Files.ReadWrite.AppFolder`:
 * die App sieht ausschließlich ihren eigenen Ordner `Apps/<App-Name>` im OneDrive
 * (minimale Rechte, siehe #11), nie andere Dateien. Darunter entsteht pro Beleg
 * `<Jahr>/<Kategorie>/<Datei>`; fehlende Ordner legt der Upload per Pfad selbst an.
 *
 * MSAL wird erst beim ersten Gebrauch nachgeladen, damit die Bibliothek das
 * Start-Bundle der App nicht vergrößert.
 */

import type { IPublicClientApplication } from '@azure/msal-browser'

const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID as string | undefined
const SCOPES = ['Files.ReadWrite.AppFolder']
const GRAPH = 'https://graph.microsoft.com/v1.0'

/** Ohne `VITE_MS_CLIENT_ID` (Entra-App-Registrierung) bleibt der OneDrive-Upload deaktiviert. */
export const isOneDriveConfigured = Boolean(CLIENT_ID)

let appPromise: Promise<IPublicClientApplication> | null = null

function getApp(): Promise<IPublicClientApplication> {
  if (!CLIENT_ID) return Promise.reject(new Error('OneDrive ist nicht konfiguriert (VITE_MS_CLIENT_ID fehlt).'))
  appPromise ??= import('@azure/msal-browser').then(({ PublicClientApplication }) =>
    PublicClientApplication.createPublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        // Nur private Microsoft-Konten (outlook/hotmail/live).
        authority: 'https://login.microsoftonline.com/consumers',
        // Leere statische Seite (public/auth-redirect.html), damit das Popup nicht die ganze App lädt.
        redirectUri: `${window.location.origin}/auth-redirect.html`,
      },
      cache: { cacheLocation: 'localStorage' },
    }),
  )
  return appPromise
}

/** Ob bereits ein Microsoft-Konto verbunden ist (ohne Popup, nur aus dem lokalen Cache). */
export async function isOneDriveConnected(): Promise<boolean> {
  if (!isOneDriveConfigured) return false
  const app = await getApp()
  return app.getAllAccounts().length > 0
}

/** Access-Token still aus dem Cache, sonst per Popup (Aufruf nur aus einem Klick heraus, sonst blockt der Browser das Popup). */
async function getToken(): Promise<string> {
  const app = await getApp()
  const account = app.getAllAccounts()[0]
  if (account) {
    try {
      return (await app.acquireTokenSilent({ scopes: SCOPES, account })).accessToken
    } catch {
      // Token abgelaufen und nicht still erneuerbar → unten per Popup neu anmelden.
    }
  }
  return (await app.acquireTokenPopup({ scopes: SCOPES, account })).accessToken
}

/** Einmalig mit dem Microsoft-Konto verbinden (öffnet das Anmelde-Popup). */
export async function connectOneDrive(): Promise<void> {
  await getToken()
}

/** Meldet das Microsoft-Konto in dieser App ab (lokal; die Dateien in OneDrive bleiben unberührt). */
export async function disconnectOneDrive(): Promise<void> {
  const app = await getApp()
  const account = app.getAllAccounts()[0]
  if (account) await app.clearCache({ account })
}

/** Entfernt Zeichen, die in OneDrive-Datei-/Ordnernamen verboten sind, und kürzt. */
export function safeName(name: string, maxLength = 40): string {
  return (
    name
      .replace(/[\\/:*?"<>|#%~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/, '')
      .slice(0, maxLength)
      .trim() || 'Beleg'
  )
}

export interface UploadedBeleg {
  /** Link zur Datei in OneDrive (nur mit dem eigenen Microsoft-Konto öffnbar). */
  webUrl: string
  /** Pfad unterhalb des App-Ordners, z. B. "2026/Handwerkerleistungen/2026-03-14_Firma.jpg". */
  path: string
}

/** Bis zu dieser Größe genügt ein einfacher Upload (Graph erlaubt dort max. 4 MB), darüber eine Upload-Sitzung. */
const SIMPLE_UPLOAD_MAX_BYTES = 3_500_000

async function graphError(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  return new Error(body?.error?.message ?? `${fallback} (Status ${response.status}).`)
}

/**
 * Lädt einen Beleg (Foto oder PDF) in `<App-Ordner>/<folder>/<fileName>` hoch. Kleine Dateien per
 * einfachem PUT, größere (z. B. gescannte PDFs) über eine Upload-Sitzung in einem Stück. `folder`
 * ohne führenden Schrägstrich, Segmente mit `/` getrennt.
 */
export async function uploadBeleg(blob: Blob, folder: string, fileName: string): Promise<UploadedBeleg> {
  const token = await getToken()
  const path = `${folder}/${fileName}`
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  // conflictBehavior=rename: zwei Belege gleichen Namens überschreiben sich nie gegenseitig.
  const itemUrl = `${GRAPH}/me/drive/special/approot:/${encoded}`

  let response: Response
  if (blob.size <= SIMPLE_UPLOAD_MAX_BYTES) {
    response = await fetch(`${itemUrl}:/content?@microsoft.graph.conflictBehavior=rename`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    })
  } else {
    const session = await fetch(`${itemUrl}:/createUploadSession`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
    })
    if (!session.ok) throw await graphError(session, 'OneDrive-Upload fehlgeschlagen')
    const { uploadUrl } = (await session.json()) as { uploadUrl?: string }
    if (!uploadUrl) throw new Error('OneDrive hat keine Upload-Adresse geliefert.')
    // Die Upload-Adresse ist vorab autorisiert und darf keinen Authorization-Header bekommen.
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes 0-${blob.size - 1}/${blob.size}` },
      body: blob,
    })
  }
  if (!response.ok) throw await graphError(response, 'OneDrive-Upload fehlgeschlagen')
  const item = (await response.json()) as { webUrl?: string; name?: string }
  if (!item.webUrl) throw new Error('OneDrive hat keinen Link zur hochgeladenen Datei geliefert.')
  return { webUrl: item.webUrl, path: `${folder}/${item.name ?? fileName}` }
}
