import type { UserProfile } from '../types/models'
import { safeName } from './onedrive'

/** Standard-Ordnernamen unter dem Jahresordner (im Profil überschreibbar). */
export const DEFAULT_ORDNER_HANDWERKER = 'Belege Handwerkerkosten'
export const DEFAULT_ORDNER_WERBUNGSKOSTEN = 'Rechnungen Werbekosten'

/**
 * Bringt einen eingegebenen OneDrive-Pfad in die Form `A/B/C` (relativ zum OneDrive-Stamm, ohne
 * führenden/endenden Schrägstrich). Ein Windows-Pfad wie `D:\OneDrive\01_Unterlagen\Steuern` wird
 * auf `01_Unterlagen/Steuern` gekürzt. Leer bedeutet: App-Ordner (`Apps/<App-Name>`).
 */
export function normalizePfad(input: string | undefined): string {
  if (!input) return ''
  let segments = input
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s !== '' && s !== '.' && s !== '..')
  // Laufwerksbuchstabe und der lokale OneDrive-Ordner (z. B. "OneDrive" oder "OneDrive - Persönlich") gehören nicht zum Pfad in der Cloud.
  if (segments.length > 0 && /^[a-z]:$/i.test(segments[0])) segments = segments.slice(1)
  if (segments.length > 0 && /^onedrive\b/i.test(segments[0])) segments = segments.slice(1)
  return segments.join('/')
}

export type BelegArt = 'handwerker' | 'werbungskosten'

export interface BelegZiel {
  /** Stamm-Pfad im OneDrive; leer = App-Ordner. */
  basePath: string
  /** Ordner unterhalb des Stamms: `<Jahr>/<Ordnername>`. */
  folder: string
}

/** Zielordner für einen Beleg des Jahres `year` nach den Profil-Einstellungen. */
export function belegZiel(profile: UserProfile | undefined, year: string, art: BelegArt): BelegZiel {
  const name =
    normalizePfad(art === 'handwerker' ? profile?.belegOrdnerHandwerker : profile?.belegOrdnerWerbungskosten) ||
    (art === 'handwerker' ? DEFAULT_ORDNER_HANDWERKER : DEFAULT_ORDNER_WERBUNGSKOSTEN)
  return { basePath: normalizePfad(profile?.belegBasisPfad), folder: `${year}/${name}` }
}

/** ISO-Datum YYYY-MM-DD -> JJJJ.MM.TT (Präfix der Beleg-Dateinamen, sortiert alphabetisch chronologisch). */
function datumPraefix(isoDatum: string): string {
  return isoDatum.replace(/-/g, '.')
}

/**
 * Dateiname eines Belegs in OneDrive (Issue #79):
 * - Werbungskosten: `JJJJ.MM.TT_Artikelbezeichnung.ext`
 * - Handwerker:     `JJJJ.MM.TT_Firma-Leistungsbeschreibung.ext`
 */
export function belegDateiname(
  art: BelegArt,
  isoDatum: string,
  felder: { artikel?: string; firma?: string; leistung?: string },
  extension: string,
): string {
  const prefix = datumPraefix(isoDatum)
  const text =
    art === 'werbungskosten'
      ? safeName(felder.artikel ?? '', 80)
      : `${safeName(felder.firma ?? '', 40)}-${safeName(felder.leistung ?? '', 60)}`
  return `${prefix}_${text}.${extension}`
}
