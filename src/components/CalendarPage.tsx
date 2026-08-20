import { useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '../types/models'
import { DEFAULT_ARBEITSTAGE, NO_AG_FREIE_TAGE, NO_WEEKDAYS } from '../types/models'
import { useYearEntries } from '../hooks/useYearEntries'
import { clearDayEntry, setDayEntry } from '../firebase/firestore'
import { getMonthDays, getYearDays, monthLabel, toIsoDate } from '../lib/dates'
import { calculateAttendanceQuota, requiredOfficeRatio } from '../lib/attendance'
import { calculateVacationBalances, checkRhythmViolation } from '../lib/vacation'
import { MonthGrid } from './Calendar/MonthGrid'
import { Dashboard } from './Dashboard'

interface Props {
  user: User
  profile: UserProfile
}

export function CalendarPage({ user, profile }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [warning, setWarning] = useState<string | null>(null)

  const entries = useYearEntries(user.uid, year)

  const yearDays = useMemo(() => getYearDays(year), [year])
  const arbeitstage = profile.arbeitstage ?? DEFAULT_ARBEITSTAGE
  const homeofficeWeekdays = profile.homeofficeWeekdays ?? NO_WEEKDAYS
  const agFreieTage = profile.agFreieTage ?? NO_AG_FREIE_TAGE

  // Anwesenheitsquote bezieht sich auf den gerade angezeigten Monat, nicht
  // aufs ganze Jahr — sonst würden unbelegte Zukunftsmonate (Fallback auf
  // "Büro") die Quote schon jetzt künstlich hochziehen. Eine Jahresansicht
  // kann bei Bedarf separat (z. B. im Profilbereich) ergänzt werden.
  const currentMonthDays = useMemo(() => getMonthDays(year, month), [year, month])

  const quota = useMemo(
    () =>
      calculateAttendanceQuota(
        currentMonthDays,
        profile.bundesland,
        agFreieTage,
        entries,
        requiredOfficeRatio(profile),
        arbeitstage,
        homeofficeWeekdays,
      ),
    [currentMonthDays, profile, entries, arbeitstage, homeofficeWeekdays, agFreieTage],
  )

  const balances = useMemo(
    () =>
      calculateVacationBalances(yearDays, profile.bundesland, agFreieTage, entries, profile.vacationTypes, arbeitstage),
    [yearDays, profile.bundesland, agFreieTage, entries, profile.vacationTypes, arbeitstage],
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
      <Dashboard
        quota={quota}
        quotaLabel={monthLabel(year, month)}
        balances={balances}
        vacationTypes={profile.vacationTypes}
        homeofficeErlaubt={profile.homeofficeErlaubt ?? true}
      />

      {warning && <p className="form-warning">{warning}</p>}

      <div className="card" style={{ padding: 'var(--space-3)' }}>
        <div className="month-nav">
          <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(-1)}>
            ← Vorheriger Monat
          </button>
          <h2>{monthLabel(year, month)}</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => changeMonth(1)}>
            Nächster Monat →
          </button>
        </div>

        <MonthGrid
          year={year}
          month={month}
          bundesland={profile.bundesland}
          agFreieTage={agFreieTage}
          entries={entries}
          vacationTypes={profile.vacationTypes}
          homeofficeErlaubt={profile.homeofficeErlaubt ?? true}
          arbeitstage={arbeitstage}
          homeofficeWeekdays={homeofficeWeekdays}
          onStatusChange={handleStatusChange}
          onClearStatus={handleClearStatus}
        />
      </div>
    </div>
  )
}
