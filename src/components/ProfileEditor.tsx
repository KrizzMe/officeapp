import { useState, type FormEvent } from 'react'
import type { UserProfile, Weekday } from '../types/models'
import { ALL_WEEKDAYS, DEFAULT_ARBEITSTAGE } from '../types/models'
import { BUNDESLAENDER } from '../lib/bundeslaender'
import { saveUserProfile } from '../firebase/firestore'

interface Props {
  profile: UserProfile
  onSaved: () => void
  onCancel: () => void
}

/**
 * Bearbeitung der Adress-/Wegstrecken-/Homeoffice-Felder (Abschnitt 4.1) nach
 * der Ersteinrichtung. Urlaubsarten inkl. Regelurlaub/Resturlaub werden hier
 * nicht angefasst, dafür gibt es VacationTypesManager — Farbdesign hat eine
 * eigene Sektion (ColorThemeEditor), beides bewusst getrennt statt in einem
 * langen Formular.
 */
export function ProfileEditor({ profile, onSaved, onCancel }: Props) {
  const [homeAddress, setHomeAddress] = useState(profile.homeAddress)
  const [workAddress, setWorkAddress] = useState(profile.workAddress)
  const [distanceKm, setDistanceKm] = useState(String(profile.defaultCommuteDistanceKm))
  const [bundesland, setBundesland] = useState<UserProfile['bundesland']>(profile.bundesland)
  const [arbeitstage, setArbeitstage] = useState<Weekday[]>(profile.arbeitstage ?? [...DEFAULT_ARBEITSTAGE])
  const [homeofficeErlaubt, setHomeofficeErlaubt] = useState(profile.homeofficeErlaubt ?? true)
  const [homeofficeQuote, setHomeofficeQuote] = useState(String(profile.homeofficeQuote ?? 60))
  const [homeofficeWeekdays, setHomeofficeWeekdays] = useState<Weekday[]>(profile.homeofficeWeekdays ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleArbeitstag = (day: Weekday) => {
    setArbeitstage((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return ALL_WEEKDAYS.filter((d) => next.has(d))
    })
  }

  const toggleHomeofficeWeekday = (day: Weekday) => {
    setHomeofficeWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return ALL_WEEKDAYS.filter((d) => next.has(d))
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    if (arbeitstage.length === 0) {
      setError('Bitte mindestens einen Arbeitstag auswählen.')
      setSaving(false)
      return
    }
    try {
      const updated: UserProfile = {
        ...profile,
        homeAddress,
        workAddress,
        defaultCommuteDistanceKm: Number(distanceKm) || 0,
        bundesland,
        arbeitstage,
        homeofficeErlaubt,
        homeofficeQuote: Number(homeofficeQuote) || 0,
        homeofficeWeekdays: homeofficeErlaubt ? homeofficeWeekdays : [],
      }
      await saveUserProfile(updated)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card form-card form-card--wide" style={{ marginBottom: 'var(--space-5)' }}>
      <h3 style={{ marginTop: 0 }}>Profil bearbeiten</h3>

      <div className="profile-address-grid">
        <label className="field">
          <span>Wohnadresse</span>
          <input className="input" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} required />
        </label>

        <label className="field">
          <span>Bundesland</span>
          <select
            className="input"
            value={bundesland}
            onChange={(e) => setBundesland(e.target.value as UserProfile['bundesland'])}
          >
            {BUNDESLAENDER.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Arbeitsadresse</span>
          <input className="input" value={workAddress} onChange={(e) => setWorkAddress(e.target.value)} required />
        </label>

        <label className="field">
          <span>Standard-Wegstrecke (km, einfache Fahrt)</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.1"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
        <span>Arbeitstage</span>
        <div className="weekday-toggle-group">
          {ALL_WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              className={`weekday-toggle${arbeitstage.includes(day) ? ' weekday-toggle--active' : ''}`}
              aria-pressed={arbeitstage.includes(day)}
              onClick={() => toggleArbeitstag(day)}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <label className="checkbox-label" style={{ marginBottom: 'var(--space-3)' }}>
        <input
          type="checkbox"
          checked={homeofficeErlaubt}
          onChange={(e) => setHomeofficeErlaubt(e.target.checked)}
        />
        <span>Home Office erlaubt</span>
      </label>

      {homeofficeErlaubt && (
        <label className="field">
          <span>Home-Office-Quote (max. % der Arbeitstage, Rest muss Büro/Dienstreise sein)</span>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            value={homeofficeQuote}
            onChange={(e) => setHomeofficeQuote(e.target.value)}
            required
          />
        </label>
      )}

      {homeofficeErlaubt && (
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <span>Regelmäßige Homeoffice-Tage (Vorbelegung für zukünftige Monate)</span>
          <div className="weekday-toggle-group">
            {ALL_WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                className={`weekday-toggle${homeofficeWeekdays.includes(day) ? ' weekday-toggle--active' : ''}`}
                aria-pressed={homeofficeWeekdays.includes(day)}
                onClick={() => toggleHomeofficeWeekday(day)}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="form-hint">
            Gilt nur für kommende Monate ohne manuelle Änderung — der aktuelle und vergangene Monate bleiben unverändert.
          </p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}
