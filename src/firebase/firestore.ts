import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from './config'
import type { DayEntry, UserProfile } from '../types/models'

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

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(userDoc(profile.uid), profile)
}

export async function setDayEntry(uid: string, entry: DayEntry): Promise<void> {
  await setDoc(dayDoc(uid, entry.date), entry)
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
export async function countDayEntriesWithStatus(uid: string, status: string): Promise<number> {
  const daysRef = collection(db, 'users', uid, 'days')
  const snapshot = await getDocs(query(daysRef, where('status', '==', status)))
  return snapshot.size
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
