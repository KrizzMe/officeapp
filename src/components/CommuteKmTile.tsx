import type { CommuteSummary } from '../lib/commute'

interface Props {
  summary: CommuteSummary
  /** Optionale Zeitraum-Bezeichnung im Titel, z. B. "August 2026"; entfällt, wenn der Kontext (Überschrift) sie schon nennt. */
  periodLabel?: string
}

/** Kilometer-Kachel für die Pendlerpauschale (Abschnitt 5.3), für Monat und Jahr. */
export function CommuteKmTile({ summary, periodLabel }: Props) {
  return (
    <div className="card stat-tile">
      <span className="stat-label">{periodLabel ? `Arbeitsweg ${periodLabel}` : 'Arbeitsweg'}</span>
      <span className="stat-value">
        {summary.totalKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km
      </span>
      <span className="stat-sub">
        {summary.days} Bürotage bis heute
        {summary.overrideDays > 0 && `, davon ${summary.overrideDays} mit abweichender Strecke`}
      </span>
    </div>
  )
}
