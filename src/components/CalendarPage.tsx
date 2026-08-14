import { useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '../types/models'
import { useYearEntries } from '../hooks/useYearEntries'
import { clearDayEntry, setDayEntry } from '../firebase/firestore'
import { getMonthDays, toIsoDate } from '../lib/dates'
import { calculateAttendanceQuota } from '../lib/attendance'
import { calculateVacationBalances, checkRhythmViolation } from '../lib/vacation'
import { MonthGrid } from './Calendar/MonthGrid'
import { Dashboard } from './Dashboard'
import { VacationTypesManager } from './VacationTypesManager'

interface Props {
  user: User
  profile: UserProfile
  onProfileChange: () => void
}

export function CalendarPage({ user, profile, onProfileChange }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [warning, setWarning] = useState<string | null>(null)
  const [showVacationTypes, setShowVacationTypes] = useState(false)

  const entries = useYearEntries(user.uid, year)

  const yearDays = useMemo(() => {
    const days: Date[] = []
    for (let m = 0; m < 12; m++) days.push(...getMonthDays(year, m))
    return days
  }, [year])

  // Anwesenheitsquote bezieht sich auf den gerade angezeigten Monat, nicht
  // aufs ganze Jahr — sonst würden unbelegte Zukunftsmonate (Fallback auf
  // "Büro") die Quote schon jetzt künstlich hochziehen. Eine Jahresansicht
  // kann bei Bedarf separat (z. B. im Profilbereich) ergänzt werden.
  const currentMonthDays = useMemo(() => getMonthDays(year, month), [year, month])

  const quota = useMemo(
    () => calculateAttendanceQuota(currentMonthDays, profile.bundesland, entries),
    [currentMonthDays, profile.bundesland, entries],
  )

  const balances = useMemo(
    () => calculateVacationBalances(yearDays, profile.bundesland, entries, profile.vacationTypes),
    [yearDays, profile.bundesland, entries, profile.vacationTypes],
  )

  const changeMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m)
    setYear(y)
  }

  const handleStatusChange = async (date: Date, status: string) => {
    setWarning(null)
    const vacationType = profile.vacationTypes.find((v) => v.id === status)
    if (vacationType) {
      const { violated, usedInPeriod } = checkRhythmViolation(date, vacationType, entries)
      if (violated) {
        setWarning(
          `${vacationType.name}: In diesem Quartal bereits ${usedInPeriod} von ${vacationType.rhythm?.maxPerPeriod} Tag(en) verplant.`,
        )
      }
    }
    await setDayEntry(user.uid, { date: toIsoDate(date), status })
  }

  const handleClearStatus = async (date: Date) => {
    setWarning(null)
    await clearDayEntry(user.uid, toIsoDate(date))
  }

  return (
    <div>
      <Dashboard quota={quota} balances={balances} vacationTypes={profile.vacationTypes} />

      {warning && (
        <p style={{ color: '#b8860b', border: '1px solid #b8860b', padding: 8, borderRadius: 4 }}>{warning}</p>
      )}

      <div style={{ marginBottom: 8 }}>
        <button onClick={() => setShowVacationTypes((v) => !v)}>
          {showVacationTypes ? 'Urlaubsarten ausblenden' : 'Urlaubsarten verwalten'}
        </button>
      </div>

      {showVacationTypes && <VacationTypesManager profile={profile} onUpdated={onProfileChange} />}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => changeMonth(-1)}>← Vorheriger Monat</button>
        <button onClick={() => changeMonth(1)}>Nächster Monat →</button>
      </div>

      <MonthGrid
        year={year}
        month={month}
        bundesland={profile.bundesland}
        entries={entries}
        vacationTypes={profile.vacationTypes}
        onStatusChange={handleStatusChange}
        onClearStatus={handleClearStatus}
      />
    </div>
  )
}
