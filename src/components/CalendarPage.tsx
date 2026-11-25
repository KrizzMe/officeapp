import { useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '../types/models'
import { DEFAULT_ARBEITSTAGE, NO_AG_FREIE_TAGE, NO_WEEKDAYS } from '../types/models'
import { useYearEntries } from '../hooks/useYearEntries'
import { setDayArbeitszeit, setDayStatus } from '../firebase/firestore'
import { getMonthDays, getYearDays, MONTH_LABELS, monthLabel, toIsoDate } from '../lib/dates'
import { calculateAttendanceQuota, calculateSickDays, effectiveDayStatus, requiredOfficeRatio } from '../lib/attendance'
import { calculateVacationBalances, checkRhythmViolation } from '../lib/vacation'
import { useVacationTypes } from '../hooks/useVacationTypes'
import { calculateCommuteSummary } from '../lib/commute'
import { MonthGrid } from './Calendar/MonthGrid'
import { MonthStats } from './MonthStats'
import { ArbeitszeitDialog } from './ArbeitszeitDialog'
import { ArbeitszeitSaldoTile } from './ArbeitszeitSaldoTile'
import { useArbeitszeitKonto } from '../hooks/useArbeitszeitKonto'
import { formatDauer, formatSaldo, summiereArbeitszeit, type Arbeitszeit } from '../lib/arbeitszeit'

interface Props {
  user: User
  profile: UserProfile
}

export function CalendarPage({ user, profile }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [warning, setWarning] = useState<string | null>(null)
  const [zeitDate, setZeitDate] = useState<Date | null>(null)

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

  const sickDays = useMemo(
    () => calculateSickDays(currentMonthDays, profile.bundesland, agFreieTage, entries, arbeitstage),
    [currentMonthDays, profile.bundesland, agFreieTage, entries, arbeitstage],
  )

  const commute = useMemo(
    () =>
      calculateCommuteSummary(
        currentMonthDays,
        profile.bundesland,
        agFreieTage,
        entries,
        profile.defaultCommuteDistanceKm,
        arbeitstage,
      ),
    [currentMonthDays, profile.bundesland, profile.defaultCommuteDistanceKm, agFreieTage, entries, arbeitstage],
  )

  const { vacationTypes } = useVacationTypes(profile, year)

  const balances = useMemo(
    () =>
      calculateVacationBalances(yearDays, profile.bundesland, agFreieTage, entries, vacationTypes, arbeitstage),
    [yearDays, profile.bundesland, agFreieTage, entries, vacationTypes, arbeitstage],
  )

  const konto = useArbeitszeitKonto(profile, year)
  const monatsZeit = useMemo(
    () => (konto.ctx ? summiereArbeitszeit(currentMonthDays, entries, konto.ctx) : null),
    [konto.ctx, currentMonthDays, entries],
  )

  const defaultStatusOf = (date: Date) => {
    const s = effectiveDayStatus(date, profile.bundesland, agFreieTage, undefined, arbeitstage, homeofficeWeekdays)
    return typeof s === 'string' ? s : 'buero'
  }

  const handleSaveZeit = async (zeit: Arbeitszeit | null) => {
    if (!zeitDate) return
    const iso = toIsoDate(zeitDate)
    await setDayArbeitszeit(user.uid, iso, zeit, defaultStatusOf(zeitDate), entries.get(iso))
  }

  const changeMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m)
    setYear(y)
  }

  const handleStatusChange = async (date: Date, status: string, defaultStatus: string) => {
    setWarning(null)
    const vacationType = vacationTypes.find((v) => v.id === status)
    if (vacationType) {
      const { violated, usedInPeriod } = checkRhythmViolation(date, vacationType, entries)
      if (violated) {
        setWarning(
          `${vacationType.name}: In diesem Quartal bereits ${usedInPeriod} von ${vacationType.rhythm?.maxPerPeriod} Tag(en) verplant.`,
        )
      }
    }
    const iso = toIsoDate(date)
    await setDayStatus(user.uid, iso, status, defaultStatus, entries.get(iso))
  }

  return (
    <div>
      <MonthStats
        quota={quota}
        quotaLabel={monthLabel(year, month)}
        commute={commute}
        krankDays={sickDays.krankDays}
        monthName={MONTH_LABELS[month]}
        balances={balances}
        vacationTypes={vacationTypes}
        homeofficeErlaubt={profile.homeofficeErlaubt ?? true}
        year={year}
        arbeitszeitTile={
          <ArbeitszeitSaldoTile label={`Überstunden ${MONTH_LABELS[month]}`} saldoMin={monatsZeit?.saldoMin ?? null}>
            {monatsZeit && (
              <>
                <span className="stat-sub">
                  Ist {formatDauer(monatsZeit.istMin)} h von Soll {formatDauer(monatsZeit.sollMin)} h
                </span>
                <span className="stat-sub">
                  Saldo {year} gesamt: {formatSaldo(konto.gesamtSaldoMin)} h
                </span>
                {monatsZeit.fehlendeTage > 0 && (
                  <span className="stat-sub stat-sub--warning">
                    {monatsZeit.fehlendeTage} {monatsZeit.fehlendeTage === 1 ? 'Tag' : 'Tage'} ohne Zeiten
                  </span>
                )}
              </>
            )}
          </ArbeitszeitSaldoTile>
        }
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
          vacationTypes={vacationTypes}
          homeofficeErlaubt={profile.homeofficeErlaubt ?? true}
          arbeitstage={arbeitstage}
          homeofficeWeekdays={homeofficeWeekdays}
          onStatusChange={handleStatusChange}
          onEditZeit={setZeitDate}
        />
      </div>

      {zeitDate && (
        <ArbeitszeitDialog
          key={toIsoDate(zeitDate)}
          date={zeitDate}
          entry={entries.get(toIsoDate(zeitDate))}
          sollMin={konto.ctx?.sollMin ?? null}
          onSave={handleSaveZeit}
          onClose={() => setZeitDate(null)}
        />
      )}
    </div>
  )
}
