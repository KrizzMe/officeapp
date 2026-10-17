import type { User } from 'firebase/auth'

/** Ergebnis der Beleg-Auslesung (siehe vercel-api/api/extract-beleg.ts). Fehlende Werte sind null. */
export interface BelegScanResult {
  art: 'handwerker' | 'werbungskosten' | 'unklar'
  /** Rechnungsdatum, ISO YYYY-MM-DD. */
  datum: string | null
  aussteller: string | null
  rechnungsnummer: string | null
  beschreibung: string | null
  leistungszeitraum: string | null
  bruttoBetrag: number | null
  mwstBetrag: number | null
  arbeitskostenNetto: number | null
  materialkostenNetto: number | null
  kategorie: string | null
}

const API_URL = import.meta.env.VITE_BELEG_API_URL as string | undefined

/** Ohne `VITE_BELEG_API_URL` bleibt die Auslese-Funktion ausgeblendet (die Erfassung per Hand läuft weiter). */
export const isBelegScanConfigured = Boolean(API_URL)

/** Schickt das verkleinerte Belegfoto (bei PDFs: die ersten Seiten) an die Serverfunktion und liefert die ausgelesenen Felder. */
export async function scanBeleg(user: User, imageDataUrls: string[], kategorien: string[] = []): Promise<BelegScanResult> {
  if (!API_URL) throw new Error('Die Beleg-Auslesung ist nicht konfiguriert (VITE_BELEG_API_URL fehlt).')
  const idToken = await user.getIdToken()

  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ imageDataUrls, kategorien }),
    })
  } catch {
    throw new Error('Der Auslese-Dienst ist nicht erreichbar. Bitte Verbindung prüfen.')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Das Auslesen ist fehlgeschlagen (Status ${response.status}).`)
  }
  return (await response.json()) as BelegScanResult
}

/** Netto-Materialkosten für das Handwerker-Formular: direkt, sonst aus Netto minus Arbeitskosten, sonst 0. */
export function materialkostenAusScan(scan: BelegScanResult, mwstFaktor: number): number {
  if (scan.materialkostenNetto !== null) return scan.materialkostenNetto
  if (scan.arbeitskostenNetto !== null && scan.bruttoBetrag !== null) {
    return Math.max(0, Math.round((scan.bruttoBetrag / mwstFaktor - scan.arbeitskostenNetto) * 100) / 100)
  }
  return 0
}
