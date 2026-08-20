import { useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile, Weekday } from '../types/models'
import { ALL_WEEKDAYS, DEFAULT_ARBEITSTAGE, DEFAULT_VACATION_TYPE_IDS } from '../types/models'
import { BUNDESLAENDER } from '../lib/bundeslaender'
import { DEFAULT_COLOR_THEME } from '../lib/colorThemes'
import { saveUserProfile } from '../firebase/firestore'

interface Props {
  user: User
  onDone: () => void
}

export function ProfileSetup({ user, onDone }: Props) {
  const [homeAddress, setHomeAddress] = useState('')
  const [workAddress, setWorkAddress] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [bundesland, setBundesland] = useState('BY')
  const [urlaubTage, setUrlaubTage] = useState('30')
  const [resturlaubTage, setResturlaubTage] = useState('0')
  const [arbeitstage, setArbeitstage] = useState<Weekday[]>([...DEFAULT_ARBEITSTAGE])
  const [homeofficeErlaubt, setHomeofficeErlaubt] = useState(true)
  const [homeofficeQuote, setHomeofficeQuote] = useState('60')
  const [homeofficeWeekdays, setHomeofficeWeekdays] = useState<Weekday[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleArbeitstag = (day: Weekday) => {
    const wasArbeitstag = arbeitstage.includes(day)
    setArbeitstage((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return ALL_WEEKDAYS.filter((d) => next.has(d))
    })
    // Kein Arbeitstag mehr => auch kein wählbarer Homeoffice-Wochentag mehr.
    if (wasArbeitstag) {
      setHomeofficeWeekdays((prev) => prev.filter((d) => d !== day))
    }
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
      const profile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? 'Nutzer',
        homeAddress,
        workAddress,
        defaultCommuteDistanceKm: Number(distanceKm) || 0,
        bundesland: bundesland as UserProfile['bundesland'],
        colorTheme: DEFAULT_COLOR_THEME,
        arbeitstage,
        homeofficeErlaubt,
        homeofficeQuote: Number(homeofficeQuote) || 0,
        homeofficeWeekdays: homeofficeErlaubt ? homeofficeWeekdays : [],
        vacationTypes: [
          { id: DEFAULT_VACATION_TYPE_IDS.urlaub, name: 'Urlaub', totalDays: Number(urlaubTage) || 0 },
          { id: DEFAULT_VACATION_TYPE_IDS.resturlaub, name: 'Resturlaub', totalDays: Number(resturlaubTage) || 0 },
        ],
      }
      await saveUserProfile(profile)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card form-card">
      <h2>Profil einrichten</h2>
      <p>Einmalige Grundeinstellungen, später jederzeit änderbar.</p>

      <label className="field">
        <span>Wohnadresse</span>
        <input className="input" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} required />
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

      <label className="field">
        <span>Bundesland</span>
        <select className="input" value={bundesland} onChange={(e) => setBundesland(e.target.value)}>
          {BUNDESLAENDER.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Regelurlaub (Tage/Jahr)</span>
        <input
          className="input"
          type="number"
          min="0"
          value={urlaubTage}
          onChange={(e) => setUrlaubTage(e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Resturlaub aus Vorjahr (Tage)</span>
        <input
          className="input"
          type="number"
          min="0"
          value={resturlaubTage}
          onChange={(e) => setResturlaubTage(e.target.value)}
          required
        />
      </label>

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
            {arbeitstage.map((day) => (
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
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Speichern…' : 'Profil speichern'}
        </button>
      </div>
    </form>
  )
}
