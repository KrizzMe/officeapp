import { useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '../types/models'
import { DEFAULT_ARBEITSTAGE, NO_AG_FREIE_TAGE, NO_WEEKDAYS } from '../types/models'
import { useYearEntries } from '../hooks/useYearEntries'
import { clearDayEntry, setDayEntry } from '../firebase/firestore'
import { getMonthDays, monthLabel, toIsoDate } from '../lib/dates'
import { calculateAttendanceQuota, effectiveDayStatus, requiredOfficeRatio } from '../lib/attendance'
import { checkRhythmViolation } from '../lib/vacation'
import { statusVisual } from '../lib/statusColors'
import { buildStatusOptions, statusLabel } from '../lib/statusOptions'
import { AttendanceQuotaTile } from './AttendanceQuotaTile'
import { StatusDropdown } from './Calendar/StatusDropdown'

interface Props {
  user: User
  profile: UserProfile
}

/** Home-Dashboard: zeigt nur Anwesenheitsquote und den änderbaren heutigen Status. */
export function HomeDashboard({ user, profile }: Props) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const [warning, setWarning] = useState<string | null>(null)

  const entries = useYearEntries(user.uid, year)

  const arbeitstage = profile.arbeitstage ?? DEFAULT_ARBEITSTAGE
  const homeofficeWeekdays = profile.homeofficeWeekdays ?? NO_WEEKDAYS
  const agFreieTage = profile.agFreieTage ?? NO_AG_FREIE_TAGE
  const homeofficeErlaubt = profile.homeofficeErlaubt ?? true

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

  const todayIso = toIsoDate(today)
  const todayStatus = effectiveDayStatus(today, profile.bundesland, agFreieTage, entries.get(todayIso), arbeitstage, homeofficeWeekdays)
  const todayStatusId = typeof todayStatus === 'string' ? todayStatus : 'buero'
  const isEditableToday = todayStatus !== 'wochenende' && todayStatus !== 'feiertag'
  const visual = statusVisual(todayStatusId)

  const defaultStatus = effectiveDayStatus(today, profile.bundesland, agFreieTage, undefined, arbeitstage, homeofficeWeekdays)
  const defaultStatusId = typeof defaultStatus === 'string' ? defaultStatus : 'buero'

  const handleStatusChange = async (value: string) => {
    setWarning(null)
    const vacationType = profile.vacationTypes.find((v) => v.id === value)
    if (vacationType) {
      const { violated, usedInPeriod } = checkRhythmViolation(today, vacationType, entries)
      if (violated) {
        setWarning(
          `${vacationType.name}: In diesem Quartal bereits ${usedInPeriod} von ${vacationType.rhythm?.maxPerPeriod} Tag(en) verplant.`,
        )
      }
    }
    if (value === defaultStatusId) {
      await clearDayEntry(user.uid, todayIso)
    } else {
      await setDayEntry(user.uid, { date: todayIso, status: value })
    }
  }

  return (
    <div className="card-grid">
      {homeofficeErlaubt && <AttendanceQuotaTile quota={quota} periodLabel={monthLabel(year, month)} />}

      <div className="card stat-tile">
        <span className="stat-label">Heutiger Status</span>
        {isEditableToday ? (
          <StatusDropdown
            value={todayStatusId}
            options={buildStatusOptions(profile.vacationTypes, homeofficeErlaubt, todayStatusId)}
            onChange={handleStatusChange}
            color={visual.color}
            hatched={visual.hatched}
            showLabelWhenClosed
            ariaLabel={`Status für heute: ${statusLabel(todayStatusId, profile.vacationTypes)}`}
          />
        ) : (
          <span className="stat-value">{todayStatus === 'wochenende' ? 'Wochenende' : 'Feiertag'}</span>
        )}
        {warning && <p className="form-warning">{warning}</p>}
      </div>
    </div>
  )
}
