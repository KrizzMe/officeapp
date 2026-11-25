import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './config'
import type { DayEntry, HandwerkerBeleg, UserProfile, WerbungskostenBeleg } from '../types/models'
import { arbeitszeitOf, type Arbeitszeit } from '../lib/arbeitszeit'

function userDoc(uid: string) {
  return doc(db, 'users', uid)
}

function dayDoc(uid: string, date: string) {
  return doc(db, 'users', uid, 'days', date)
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDoc(uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

/**
 * Legt das Profildokument komplett neu an (Ersteinrichtung, ProfileSetup).
 * Für Änderungen an einem bestehenden Profil stattdessen updateUserProfile()
 * benutzen — eine Vollschreibung würde dort parallel geänderte Felder anderer
 * Profilsektionen überschreiben (siehe dort).
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(userDoc(profile.uid), profile)
}

/**
 * Schreibt nur die übergebenen Profilfelder (Issue #65). Der Profilbereich
 * zeigt vier Sektionen gleichzeitig (Profilformular, Urlaubsarten, AG-freie
 * Tage, Farbdesign), die alle dasselbe `profile`-Objekt als Ausgangsbasis
 * haben. Schrieb jede davon das ganze Dokument, machte ein Speichern in der
 * einen Sektion eine noch nicht nachgeladene Änderung einer anderen still
 * zunichte. Mit einem Teilupdate bleiben nicht übergebene Felder unberührt.
 */
export async function updateUserProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  await updateDoc(userDoc(uid), patch)
}

/**
 * Setzt (Minuten) oder entfernt (`null` = wieder automatisch) den manuellen
 * Überstunden-Übertrag eines Jahres (Issue #83). Feldpfad-Update, damit
 * parallel geänderte Übertrage anderer Jahre nicht überschrieben werden.
 */
export async function setArbeitszeitUebertrag(uid: string, year: number, minuten: number | null): Promise<void> {
  await updateDoc(userDoc(uid), {
    [`arbeitszeitUebertragByYear.${year}`]: minuten === null ? deleteField() : minuten,
  })
}

export async function setDayEntry(uid: string, entry: DayEntry): Promise<void> {
  await setDoc(dayDoc(uid, entry.date), entry)
}

/**
 * Setzt den Freitext-Grund für alle übergebenen Tageseinträge gleichzeitig
 * (Issue #33, ein Grund pro zusammenhängendem Zeitraum in der Jahresübersicht).
 * Ein leerer Text entfernt das Feld wieder, statt eine leere Zeichenkette zu speichern.
 */
export async function setDayEntryGrund(uid: string, entries: DayEntry[], grund: string): Promise<void> {
  const trimmed = grund.trim()
  await Promise.all(
    entries.map((entry) => {
      const payload: DayEntry = { date: entry.date, status: entry.status }
      if (entry.distanceKm !== undefined) payload.distanceKm = entry.distanceKm
      if (trimmed) payload.grund = trimmed
      Object.assign(payload, zeitFelder(entry))
      return setDayEntry(uid, payload)
    }),
  )
}

/**
 * Arbeitszeit-Felder (Issue #83) eines Eintrags im Blockformat; Altformat
 * (`beginn`/`ende`) wird dabei zu `bloecke`. Firestore lehnt `undefined`-Werte
 * ab, daher nur gesetzte Felder (ein laufender Block hat kein `ende`).
 */
function zeitFelder(
  entry: Pick<DayEntry, 'bloecke' | 'beginn' | 'ende' | 'stundenMin' | 'pauseMin'> | undefined,
): Partial<DayEntry> {
  const zeit = arbeitszeitOf(entry)
  if (!zeit) return {}
  const felder: Partial<DayEntry> =
    zeit.stundenMin !== undefined
      ? { stundenMin: zeit.stundenMin }
      : { bloecke: zeit.bloecke.map((b) => (b.ende ? { beginn: b.beginn, ende: b.ende } : { beginn: b.beginn })) }
  if (zeit.pauseMin !== undefined && zeit.pauseMin > 0) felder.pauseMin = zeit.pauseMin
  return felder
}

/**
 * Setzt den Status eines Tages. Entspricht er dem berechneten Default, wird
 * der Eintrag gelöscht (Tag fällt auf die Fallback-Logik zurück) — es sei
 * denn, für den Tag sind Arbeitszeiten erfasst (Issue #83): die bleiben bei
 * jedem Statuswechsel erhalten, der Status wird dann explizit gespeichert.
 */
export async function setDayStatus(
  uid: string,
  date: string,
  status: string,
  defaultStatus: string,
  existing: DayEntry | undefined,
): Promise<void> {
  const zeit = zeitFelder(existing)
  if (status === defaultStatus && !zeit.bloecke && !zeit.stundenMin) {
    await clearDayEntry(uid, date)
    return
  }
  await setDayEntry(uid, { date, status, ...zeit })
}

/**
 * Speichert (oder entfernt mit `null`) die Arbeitszeit eines Tages (Issue
 * #83). Andere Felder des Eintrags bleiben erhalten; bleibt ohne Zeiten nur
 * noch der Default-Status übrig, wird der Eintrag ganz gelöscht.
 */
export async function setDayArbeitszeit(
  uid: string,
  date: string,
  zeit: Arbeitszeit | null,
  defaultStatus: string,
  existing: DayEntry | undefined,
): Promise<void> {
  const payload: DayEntry = { date, status: existing?.status ?? defaultStatus }
  if (existing?.distanceKm !== undefined) payload.distanceKm = existing.distanceKm
  if (existing?.grund) payload.grund = existing.grund
  if (zeit) Object.assign(payload, zeitFelder(zeit))
  const nurDefault = payload.status === defaultStatus && payload.distanceKm === undefined && !payload.grund
  if (!zeit && nurDefault) {
    await clearDayEntry(uid, date)
    return
  }
  await setDayEntry(uid, payload)
}

/** Löscht einen Tageseintrag, sodass der Tag wieder auf die Fallback-Logik zurückfällt. */
export async function clearDayEntry(uid: string, date: string): Promise<void> {
  await deleteDoc(dayDoc(uid, date))
}

/**
 * Zählt Tageseinträge mit gegebenem Status, über alle Jahre hinweg. Dient
 * als Löschschutz für Urlaubsarten (Abschnitt 4.3) — solange Tage mit dieser
 * Urlaubsart erfasst sind, würde ihre id sonst als verwaister Status übrig bleiben.
 */
export async function countDayEntriesWithStatus(uid: string, status: string, year?: number): Promise<number> {
  const daysRef = collection(db, 'users', uid, 'days')
  const snapshot = await getDocs(query(daysRef, where('status', '==', status)))
  if (year === undefined) return snapshot.size
  // Urlaubsarten sind jahresweise (Issue #72): nur Einträge des betroffenen Jahres zählen (Dokument-id = YYYY-MM-DD).
  return snapshot.docs.filter((d) => d.id.startsWith(`${year}-`)).length
}

/**
 * Abonniert alle Tageseinträge eines Jahres (nur Ausnahmen sind als Dokument
 * vorhanden, siehe Fallback-Logik). Gibt eine Unsubscribe-Funktion zurück.
 */
export function subscribeYearEntries(
  uid: string,
  year: number,
  onData: (entries: Map<string, DayEntry>) => void,
): () => void {
  const daysRef = collection(db, 'users', uid, 'days')
  const yearQuery = query(
    daysRef,
    where(documentId(), '>=', `${year}-01-01`),
    where(documentId(), '<=', `${year}-12-31`),
  )
  return onSnapshot(yearQuery, (snapshot) => {
    const entries = new Map<string, DayEntry>()
    snapshot.forEach((docSnap) => {
      entries.set(docSnap.id, docSnap.data() as DayEntry)
    })
    onData(entries)
  })
}

/**
 * Abonniert alle Tageseinträge über alle Jahre (Issue #83): der
 * Überstunden-Übertrag verkettet die Jahressalden ab dem ersten Jahr mit
 * erfassten Zeiten. Pro Jahr sind es nur einige hundert kleine Dokumente.
 */
export function subscribeAllDayEntries(uid: string, onData: (entries: Map<string, DayEntry>) => void): () => void {
  return onSnapshot(collection(db, 'users', uid, 'days'), (snapshot) => {
    const entries = new Map<string, DayEntry>()
    snapshot.forEach((docSnap) => {
      entries.set(docSnap.id, docSnap.data() as DayEntry)
    })
    onData(entries)
  })
}

/*
 * Steuerteil (Issue #10): Belege liegen je Nutzer in einer eigenen Collection;
 * Dokument-ID = Beleg-id. Das Rechnungsdatum (reDatum, ISO) dient der
 * Jahresabfrage, ein Range-Filter auf einem einzelnen Feld braucht keinen Index.
 */
type BelegCollection = 'handwerker' | 'werbungskosten'

function subscribeBelegeYear<T extends { id: string; reDatum: string }>(
  uid: string,
  collectionName: BelegCollection,
  year: number,
  onData: (belege: T[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(
    collection(db, 'users', uid, collectionName),
    where('reDatum', '>=', `${year}-01-01`),
    where('reDatum', '<=', `${year}-12-31`),
  )
  return onSnapshot(
    q,
    (snapshot) => {
      const belege = snapshot.docs.map((d) => ({ ...(d.data() as T), id: d.id }))
      belege.sort((a, b) => a.reDatum.localeCompare(b.reDatum))
      onData(belege)
    },
    (err) => onError(err.message),
  )
}

export function subscribeHandwerkerYear(
  uid: string,
  year: number,
  onData: (belege: HandwerkerBeleg[]) => void,
  onError: (message: string) => void,
): () => void {
  return subscribeBelegeYear<HandwerkerBeleg>(uid, 'handwerker', year, onData, onError)
}

export function subscribeWerbungskostenYear(
  uid: string,
  year: number,
  onData: (belege: WerbungskostenBeleg[]) => void,
  onError: (message: string) => void,
): () => void {
  return subscribeBelegeYear<WerbungskostenBeleg>(uid, 'werbungskosten', year, onData, onError)
}

export async function saveHandwerkerBeleg(uid: string, beleg: HandwerkerBeleg): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'handwerker', beleg.id), beleg)
}

export async function deleteHandwerkerBeleg(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'handwerker', id))
}

export async function saveWerbungskostenBeleg(uid: string, beleg: WerbungskostenBeleg): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'werbungskosten', beleg.id), beleg)
}

export async function deleteWerbungskostenBeleg(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'werbungskosten', id))
}
