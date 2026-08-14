import { useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '../types/models'
import { DEFAULT_VACATION_TYPE_IDS } from '../types/models'
import { BUNDESLAENDER } from '../lib/bundeslaender'
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const profile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? 'Nutzer',
        homeAddress,
        workAddress,
        defaultCommuteDistanceKm: Number(distanceKm) || 0,
        bundesland: bundesland as UserProfile['bundesland'],
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

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Speichern…' : 'Profil speichern'}
        </button>
      </div>
    </form>
  )
}
