import { useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import type { BaseDayStatus, UserProfile } from '../types/models'
import { DEFAULT_ARBEITSTAGE, NO_AG_FREIE_TAGE, NO_WEEKDAYS } from '../types/models'
import { useYearEntries } from '../hooks/useYearEntries'
import { getMonthDays, getYearDays, monthLabel } from '../lib/dates'
import { calculateAttendanceQuota, calculateSickDays, requiredOfficeRatio } from '../lib/attendance'
import { calculateVacationBalances } from '../lib/vacation'
import { computeStatusRanges } from '../lib/statusRanges'
import { statusVisual } from '../lib/statusColors'
import { AttendanceQuotaTile } from './AttendanceQuotaTile'
import { StatusRangesTable } from './StatusRangesTable'
import { VacationBalanceTile } from './VacationBalanceTile'

interface Props {
  user: User
  profile: UserProfile
}

/** Per Klick aufklappbare Detail-Zeiträume oben in der Jahresübersicht (Issue #33). */
type DetailStatus = Extract<BaseDayStatus, 'dienstreise' | 'krank' | 'kind-krank'>

const DETAIL_LABELS: Record<DetailStatus, { title: string; grundPlaceholder: string }> = {
  dienstreise: { title: 'Dienstreisen', grundPlaceholder: 'Grund der Dienstreise (optional)' },
  krank: { title: 'Krankheitstage', grundPlaceholder: 'Grund der Krankheit (optional)' },
  'kind-krank': { title: 'Kind-krank-Tage', grundPlaceholder: 'Grund / Kind (optional)' },
}

/**
 * Jahresweite Anwesenheitsquote (Abschnitt 5.1, Issue #7) — bewusst
 * getrennt von CalendarPage, damit die dortige Monatslogik (Quote bezieht
 * sich auf den angezeigten Monat) unverändert bleibt. calculateAttendanceQuota
 * wird hier einmal übers ganze Jahr und einmal je Monat aufgerufen.
 */
export function YearOverview({ user, profile }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [activeDetail, setActiveDetail] = useState<DetailStatus | null>(null)
  const entries = useYearEntries(user.uid, year)

  const yearDays = useMemo(() => getYearDays(year), [year])
  const requiredRatio = useMemo(() => requiredOfficeRatio(profile), [profile])
  const arbeitstage = profile.arbeitstage ?? DEFAULT_ARBEITSTAGE
  const homeofficeWeekdays = profile.homeofficeWeekdays ?? NO_WEEKDAYS
  const agFreieTage = profile.agFreieTage ?? NO_AG_FREIE_TAGE
  const yearQuota = useMemo(
    () =>
      calculateAttendanceQuota(
        yearDays,
        profile.bundesland,
        agFreieTage,
        entries,
        requiredRatio,
        arbeitstage,
        homeofficeWeekdays,
      ),
    [yearDays, profile.bundesland, agFreieTage, entries, requiredRatio, arbeitstage, homeofficeWeekdays],
  )

  const monthlyQuotas = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) =>
        calculateAttendanceQuota(
          getMonthDays(year, m),
          profile.bundesland,
          agFreieTage,
          entries,
          requiredRatio,
          arbeitstage,
          homeofficeWeekdays,
        ),
      ),
    [year, profile.bundesland, agFreieTage, entries, requiredRatio, arbeitstage, homeofficeWeekdays],
  )

  const monthlySickDays = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) =>
        calculateSickDays(getMonthDays(year, m), profile.bundesland, agFreieTage, entries, arbeitstage),
      ),
    [year, profile.bundesland, agFreieTage, entries, arbeitstage],
  )

  const yearSickDays = useMemo(
    () => calculateSickDays(yearDays, profile.bundesland, agFreieTage, entries, arbeitstage),
    [yearDays, profile.bundesland, agFreieTage, entries, arbeitstage],
  )

  const vacationBalances = useMemo(
    () => calculateVacationBalances(yearDays, profile.bundesland, agFreieTage, entries, profile.vacationTypes, arbeitstage),
    [yearDays, profile.bundesland, agFreieTage, entries, profile.vacationTypes, arbeitstage],
  )

  const activeRanges = useMemo(() => {
    if (!activeDetail) return []
    return computeStatusRanges(year, activeDetail, profile.bundesland, agFreieTage, entries, arbeitstage)
  }, [activeDetail, year, profile.bundesland, agFreieTage, entries, arbeitstage])

  const toggleDetail = (status: DetailStatus) => setActiveDetail((cur) => (cur === status ? null : status))

  const homeofficeErlaubt = profile.homeofficeErlaubt ?? true

  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="month-nav">
          <button className="btn btn-secondary btn-sm" onClick={() => setYear((y) => y - 1)}>
            ← Vorheriges Jahr
          </button>
          <h2>Jahresübersicht {year}</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear((y) => y + 1)}>
            Nächstes Jahr →
          </button>
        </div>

        <div className="card-grid">
          {homeofficeErlaubt && <AttendanceQuotaTile quota={yearQuota} periodLabel={`Durchschnitt Jahr ${year}`} />}

          {vacationBalances.map((b) => {
            const vacationType = profile.vacationTypes.find((v) => v.id === b.vacationTypeId)
            if (!vacationType) return null
            return <VacationBalanceTile key={b.vacationTypeId} balance={b} vacationType={vacationType} year={year} />
          })}
        </div>
      </div>

      {homeofficeErlaubt && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <h2 style={{ marginTop: 0 }}>Weitere Übersichten</h2>
          <div className="card-grid">
            {yearQuota.businessTripDays > 0 && (
              <button
                type="button"
                className={`card stat-tile stat-tile-button ${activeDetail === 'dienstreise' ? 'is-active' : ''}`}
                onClick={() => toggleDetail('dienstreise')}
                aria-pressed={activeDetail === 'dienstreise'}
              >
                <span className="stat-label">
                  {statusVisual('dienstreise').icon} {DETAIL_LABELS.dienstreise.title}
                </span>
                <span className="stat-value">{yearQuota.businessTripDays}</span>
                <span className="stat-sub">Tage im Jahr {year}</span>
              </button>
            )}

            <button
              type="button"
              className={`card stat-tile stat-tile-button ${activeDetail === 'krank' ? 'is-active' : ''}`}
              onClick={() => toggleDetail('krank')}
              aria-pressed={activeDetail === 'krank'}
            >
              <span className="stat-label">
                {statusVisual('krank').icon} {DETAIL_LABELS.krank.title}
              </span>
              <span className="stat-value">{yearSickDays.krankDays}</span>
              <span className="stat-sub">Tage im Jahr {year}</span>
            </button>

            {yearSickDays.kindKrankDays > 0 && (
              <button
                type="button"
                className={`card stat-tile stat-tile-button ${activeDetail === 'kind-krank' ? 'is-active' : ''}`}
                onClick={() => toggleDetail('kind-krank')}
                aria-pressed={activeDetail === 'kind-krank'}
              >
                <span className="stat-label">
                  {statusVisual('kind-krank').icon} {DETAIL_LABELS['kind-krank'].title}
                </span>
                <span className="stat-value">{yearSickDays.kindKrankDays}</span>
                <span className="stat-sub">Tage im Jahr {year}</span>
              </button>
            )}
          </div>

          {activeDetail && (
            <>
              <h3 style={{ marginBottom: 'var(--space-3)' }}>{DETAIL_LABELS[activeDetail].title}</h3>
              <StatusRangesTable
                uid={user.uid}
                ranges={activeRanges}
                grundPlaceholder={DETAIL_LABELS[activeDetail].grundPlaceholder}
              />
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Monatsübersicht {year}</h2>
        <div className="table-wrap">
          <table className="table table-centered-data">
            <thead>
              <tr>
                <th>Monat</th>
                <th>Büro</th>
                <th>Dienstreise</th>
                <th>Homeoffice</th>
                <th>{statusVisual('krank').icon} Krank</th>
                <th>{statusVisual('kind-krank').icon} Kind krank</th>
                {homeofficeErlaubt && <th>Quote</th>}
              </tr>
            </thead>
            <tbody>
              {monthlyQuotas.map((q, m) => (
                <tr key={m}>
                  <td>{monthLabel(year, m)}</td>
                  <td>{q.officeDays}</td>
                  <td>{q.businessTripDays}</td>
                  <td>{q.homeofficeDays}</td>
                  <td style={{ color: statusVisual('krank').color }}>{monthlySickDays[m].krankDays}</td>
                  <td style={{ color: statusVisual('kind-krank').color }}>{monthlySickDays[m].kindKrankDays}</td>
                  {homeofficeErlaubt && (
                    <td
                      style={{
                        fontWeight: 600,
                        color: q.meetsThreshold ? 'var(--color-success)' : 'var(--color-danger)',
                      }}
                    >
                      {q.possibleWorkDays > 0 ? `${(q.ratio * 100).toFixed(0)}%` : '–'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
