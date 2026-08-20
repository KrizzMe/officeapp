import { useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile, Weekday } from '../types/models'
import { ALL_WEEKDAYS, DEFAULT_ARBEITSTAGE, DEFAULT_VACATION_TYPE_IDS } from '../types/models'
import { BUNDESLAENDER } from '../lib/bundeslaender'
import { DEFAULT_COLOR_MODE, DEFAULT_COLOR_THEME } from '../lib/colorThemes'
import { saveUserProfile } from '../firebase/firestore'
import { CommuteCheck } from './CommuteCheck'

interface Props {
  user: User
  onDone: () => void
}

export function ProfileSetup({ user, onDone }: Props) {
  const [homeStreet, setHomeStreet] = useState('')
  const [homePostalCode, setHomePostalCode] = useState('')
  const [homeCity, setHomeCity] = useState('')
  const [workStreet, setWorkStreet] = useState('')
  const [workPostalCode, setWorkPostalCode] = useState('')
  const [workCity, setWorkCity] = useState('')
  const [shortestDistanceKm, setShortestDistanceKm] = useState<number | null>(null)
  const [distanceKm, setDistanceKm] = useState('')
  const [bundesland, setBundesland] = useState<UserProfile['bundesland']>('BY')
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
        homeStreet,
        homePostalCode,
        homeCity,
        workStreet,
        workPostalCode,
        workCity,
        defaultCommuteDistanceKm: Number(distanceKm) || 0,
        ...(shortestDistanceKm !== null ? { shortestCommuteDistanceKm: shortestDistanceKm } : {}),
        bundesland,
        colorTheme: DEFAULT_COLOR_THEME,
        colorMode: DEFAULT_COLOR_MODE,
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

      <h4>Wohnadresse</h4>
      <div className="address-fields-row">
        <label className="field">
          <span>Adresse (Straße Hausnummer)</span>
          <input className="input" value={homeStreet} onChange={(e) => setHomeStreet(e.target.value)} required />
        </label>
        <label className="field">
          <span>PLZ (optional)</span>
          <input className="input" value={homePostalCode} onChange={(e) => setHomePostalCode(e.target.value)} />
        </label>
        <label className="field">
          <span>Ort</span>
          <input className="input" value={homeCity} onChange={(e) => setHomeCity(e.target.value)} required />
        </label>
      </div>

      <h4>Arbeitsadresse</h4>
      <div className="address-fields-row">
        <label className="field">
          <span>Adresse (Straße Hausnummer)</span>
          <input className="input" value={workStreet} onChange={(e) => setWorkStreet(e.target.value)} required />
        </label>
        <label className="field">
          <span>PLZ (optional)</span>
          <input className="input" value={workPostalCode} onChange={(e) => setWorkPostalCode(e.target.value)} />
        </label>
        <label className="field">
          <span>Ort</span>
          <input className="input" value={workCity} onChange={(e) => setWorkCity(e.target.value)} required />
        </label>
      </div>

      <CommuteCheck
        homeStreet={homeStreet}
        homePostalCode={homePostalCode}
        homeCity={homeCity}
        workStreet={workStreet}
        workPostalCode={workPostalCode}
        workCity={workCity}
        onApplyHome={(address, erkanntesBundesland) => {
          setHomeStreet(address.street)
          setHomePostalCode(address.postalCode)
          setHomeCity(address.city)
          if (erkanntesBundesland) setBundesland(erkanntesBundesland)
        }}
        onApplyWork={(address) => {
          setWorkStreet(address.street)
          setWorkPostalCode(address.postalCode)
          setWorkCity(address.city)
        }}
        onShortestDistance={setShortestDistanceKm}
      />

      {shortestDistanceKm !== null && (
        <div className="field">
          <span>Kürzeste Wegstrecke (km, einfache Fahrt)</span>
          <div className="form-row">
            <input className="input" value={shortestDistanceKm.toFixed(1)} readOnly />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDistanceKm(String(Math.round(shortestDistanceKm * 10) / 10))}
            >
              Als Arbeitswegstrecke übernehmen
            </button>
          </div>
        </div>
      )}

      <label className="field">
        <span>Arbeitswegstrecke (km, einfache Fahrt)</span>
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
