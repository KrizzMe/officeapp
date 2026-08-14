import { useEffect, useState } from 'react'
import type { DayEntry } from '../types/models'
import { subscribeYearEntries } from '../firebase/firestore'

export function useYearEntries(uid: string | undefined, year: number): Map<string, DayEntry> {
  const [entries, setEntries] = useState<Map<string, DayEntry>>(new Map())

  useEffect(() => {
    if (!uid) {
      setEntries(new Map())
      return
    }
    return subscribeYearEntries(uid, year, setEntries)
  }, [uid, year])

  return entries
}
