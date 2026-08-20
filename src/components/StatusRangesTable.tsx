import { useState } from 'react'
import type { DayRange } from '../lib/statusRanges'
import { MONTH_LABELS, toIsoDate } from '../lib/dates'
import { setDayEntryGrund } from '../firebase/firestore'

interface Props {
  uid: string
  ranges: DayRange[]
  grundPlaceholder: string
}

function formatShortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`
}

function formatZeitraum(range: DayRange): string {
  const startLabel = formatShortDate(range.start)
  if (range.start.getTime() === range.end.getTime()) return startLabel
  return `${startLabel} – ${formatShortDate(range.end)}`
}

/** Zeigt zusammenhängende Zeiträume eines Status (Dienstreise/Krank/Kind-krank) je Monat, mit editierbarem Grund (Issue #33). */
export function StatusRangesTable({ uid, ranges, grundPlaceholder }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  if (ranges.length === 0) {
    return (
      <p className="form-hint" style={{ marginTop: 0, marginBottom: 0 }}>
        Keine Einträge in diesem Jahr.
      </p>
    )
  }

  const handleBlur = async (range: DayRange, key: string) => {
    const value = drafts[key]
    if (value === undefined) return
    setSavingKey(key)
    try {
      await setDayEntryGrund(uid, range.entries, value)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Monat</th>
            <th>Zeitraum</th>
            <th>Tage</th>
            <th>Grund</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((range) => {
            const key = toIsoDate(range.start)
            const value = drafts[key] ?? range.entries[0]?.grund ?? ''
            return (
              <tr key={key}>
                <td>{MONTH_LABELS[range.start.getMonth()]}</td>
                <td>{formatZeitraum(range)}</td>
                <td>{range.days}</td>
                <td>
                  <input
                    className="input"
                    placeholder={grundPlaceholder}
                    value={value}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    onBlur={() => handleBlur(range, key)}
                    disabled={savingKey === key}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
