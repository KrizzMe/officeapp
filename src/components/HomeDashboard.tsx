import { useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '../types/models'
import { DEFAULT_ARBEITSTAGE, NO_AG_FREIE_TAGE, NO_WEEKDAYS } from '../types/models'
import { useYearEntries } from '../hooks/useYearEntries'
import { setDayStatus } from '../firebase/firestore'
import { getMonthDays, monthLabel, toIsoDate } from '../lib/dates'
import { calculateAttendanceQuota, effectiveDayStatus, requiredOfficeRatio } from '../lib/attendance'
import { checkRhythmViolation } from '../lib/vacation'
import { useVacationTypes } from '../hooks/useVacationTypes'
import { statusVisual } from '../lib/statusColors'
import { buildStatusOptions, statusLabel } from '../lib/statusOptions'
import { AttendanceQuotaTile } from './AttendanceQuotaTile'
import { StatusDropdown } from './Calendar/StatusDropdown'
import { ArbeitszeitSaldoTile } from './ArbeitszeitSaldoTile'
import { useArbeitszeitKonto } from '../hooks/useArbeitszeitKonto'
import { formatSaldo } from '../lib/arbeitszeit'

interface Props {
  user: User
  profile: UserProfile
}

/** Home-Dashboard: Anwesenheitsquote, änderbarer heutiger Status und Überstunden-Saldo (Issue #83). */
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
  const { vacationTypes } = useVacationTypes(profile, year)
  const konto = useArbeitszeitKonto(profile, year)

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
    const vacationType = vacationTypes.find((v) => v.id === value)
    if (vacationType) {
      const { violated, usedInPeriod } = checkRhythmViolation(today, vacationType, entries)
      if (violated) {
        setWarning(
          `${vacationType.name}: In diesem Quartal bereits ${usedInPeriod} von ${vacationType.rhythm?.maxPerPeriod} Tag(en) verplant.`,
        )
      }
    }
    await setDayStatus(user.uid, todayIso, value, defaultStatusId, entries.get(todayIso))
  }

  return (
    <div className="card-grid dashboard-grid">
      {homeofficeErlaubt && <AttendanceQuotaTile quota={quota} periodLabel={monthLabel(year, month)} />}

      <div className="card stat-tile">
        <span className="stat-label">Dein heutiger Status</span>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {isEditableToday ? (
            <StatusDropdown
              value={todayStatusId}
              options={buildStatusOptions(vacationTypes, homeofficeErlaubt, todayStatusId)}
              onChange={handleStatusChange}
              color={visual.color}
              hatched={visual.hatched}
              showLabelWhenClosed
              ariaLabel={`Status für heute: ${statusLabel(todayStatusId, vacationTypes)}`}
            />
          ) : (
            <span className="stat-value">{todayStatus === 'wochenende' ? 'Wochenende' : 'Feiertag'}</span>
          )}
        </div>
        {warning && <p className="form-warning">{warning}</p>}
      </div>

      <ArbeitszeitSaldoTile label="Überstunden-Saldo" saldoMin={konto.ctx ? konto.gesamtSaldoMin : null}>
        <span className="stat-sub">
          Stand heute, inkl. Übertrag {formatSaldo(konto.uebertrag.minuten)} h aus {year - 1}
        </span>
        {konto.jahr.fehlendeTage > 0 && (
          <span className="stat-sub stat-sub--warning">
            {konto.jahr.fehlendeTage} {konto.jahr.fehlendeTage === 1 ? 'Tag' : 'Tage'} in {year} ohne Zeiten
          </span>
        )}
      </ArbeitszeitSaldoTile>
    </div>
  )
}
