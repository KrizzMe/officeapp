import { useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '../types/models'
import { DEFAULT_ARBEITSTAGE, NO_AG_FREIE_TAGE, NO_WEEKDAYS } from '../types/models'
import { useYearEntries } from '../hooks/useYearEntries'
import { getMonthDays, getYearDays, monthLabel } from '../lib/dates'
import { calculateAttendanceQuota, calculateSickDays, requiredOfficeRatio } from '../lib/attendance'
import { statusVisual } from '../lib/statusColors'

interface Props {
  user: User
  profile: UserProfile
}

/**
 * Jahresweite Anwesenheitsquote (Abschnitt 5.1, Issue #7) — bewusst
 * getrennt von CalendarPage, damit die dortige Monatslogik (Quote bezieht
 * sich auf den angezeigten Monat) unverändert bleibt. calculateAttendanceQuota
 * wird hier einmal übers ganze Jahr und einmal je Monat aufgerufen.
 */
export function YearOverview({ user, profile }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
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

  const yearQuotaPercent = Math.min(100, yearQuota.ratio * 100)
  const homeofficeErlaubt = profile.homeofficeErlaubt ?? true

  return (
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

      {homeofficeErlaubt && (
        <div className="card-grid">
          <div className="card stat-tile">
            <span className="stat-label">Anwesenheitsquote (Jahr {year})</span>
            <span className={`stat-value ${yearQuota.meetsThreshold ? 'is-positive' : 'is-negative'}`}>
              {(yearQuota.ratio * 100).toFixed(1)}%
            </span>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${yearQuotaPercent}%`,
                  background: yearQuota.meetsThreshold ? 'var(--color-success)' : 'var(--color-danger)',
                }}
              />
            </div>
            <span className="stat-sub">
              Büro {yearQuota.officeDays} + Dienstreise {yearQuota.businessTripDays} von {yearQuota.possibleWorkDays}{' '}
              möglichen Arbeitstagen · Ziel ≥ {(yearQuota.requiredOfficeRatio * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Monat</th>
              <th>Büro</th>
              <th>Homeoffice</th>
              <th>Dienstreise</th>
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
                <td>{q.homeofficeDays}</td>
                <td>{q.businessTripDays}</td>
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

      <p className="form-hint" style={{ marginTop: 'var(--space-3)' }}>
        Tage ohne Eintrag zählen als Büro (Fallback-Logik) — Monate ganz oder teilweise in der Zukunft zeigen daher
        vorläufig eine höhere Quote, als sich am Ende tatsächlich ergibt.
      </p>
    </div>
  )
}
