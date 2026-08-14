import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ColorTheme, UserProfile } from '../types/models'
import { DEFAULT_VACATION_TYPE_IDS } from '../types/models'
import { BUNDESLAENDER } from '../lib/bundeslaender'
import { COLOR_THEMES, DEFAULT_COLOR_THEME } from '../lib/colorThemes'
import { saveUserProfile } from '../firebase/firestore'

interface Props {
  profile: UserProfile
  onSaved: () => void
  onCancel: () => void
}

function vacationDays(profile: UserProfile, id: string): string {
  return String(profile.vacationTypes.find((t) => t.id === id)?.totalDays ?? 0)
}

/**
 * Bearbeitung der Onboarding-Felder (Abschnitt 4.1) nach der Ersteinrichtung.
 * Frei definierte Urlaubsarten (Abschnitt 4.3) werden hier nicht angefasst,
 * dafür gibt es VacationTypesManager — nur Urlaub/Resturlaub als deren
 * Grundkontingente werden mitbearbeitet.
 */
export function ProfileEditor({ profile, onSaved, onCancel }: Props) {
  const [homeAddress, setHomeAddress] = useState(profile.homeAddress)
  const [workAddress, setWorkAddress] = useState(profile.workAddress)
  const [distanceKm, setDistanceKm] = useState(String(profile.defaultCommuteDistanceKm))
  const [bundesland, setBundesland] = useState<UserProfile['bundesland']>(profile.bundesland)
  const [urlaubTage, setUrlaubTage] = useState(vacationDays(profile, DEFAULT_VACATION_TYPE_IDS.urlaub))
  const [resturlaubTage, setResturlaubTage] = useState(vacationDays(profile, DEFAULT_VACATION_TYPE_IDS.resturlaub))
  const [colorTheme, setColorTheme] = useState<ColorTheme>(profile.colorTheme ?? DEFAULT_COLOR_THEME)
  const [homeofficeErlaubt, setHomeofficeErlaubt] = useState(profile.homeofficeErlaubt ?? true)
  const [homeofficeQuote, setHomeofficeQuote] = useState(String(profile.homeofficeQuote ?? 60))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const themeCommitted = useRef(false)

  // Direktvorschau: gewähltes Design sofort anwenden, beim Verlassen ohne
  // Speichern wieder auf das aktuell gespeicherte Design zurücksetzen.
  useEffect(() => {
    document.documentElement.dataset.theme = colorTheme
  }, [colorTheme])

  useEffect(
    () => () => {
      if (!themeCommitted.current) {
        document.documentElement.dataset.theme = profile.colorTheme ?? DEFAULT_COLOR_THEME
      }
    },
    [profile.colorTheme],
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const otherTypes = profile.vacationTypes.filter(
        (t) => t.id !== DEFAULT_VACATION_TYPE_IDS.urlaub && t.id !== DEFAULT_VACATION_TYPE_IDS.resturlaub,
      )
      const updated: UserProfile = {
        ...profile,
        homeAddress,
        workAddress,
        defaultCommuteDistanceKm: Number(distanceKm) || 0,
        bundesland,
        colorTheme,
        homeofficeErlaubt,
        homeofficeQuote: Number(homeofficeQuote) || 0,
        vacationTypes: [
          { id: DEFAULT_VACATION_TYPE_IDS.urlaub, name: 'Urlaub', totalDays: Number(urlaubTage) || 0 },
          { id: DEFAULT_VACATION_TYPE_IDS.resturlaub, name: 'Resturlaub', totalDays: Number(resturlaubTage) || 0 },
          ...otherTypes,
        ],
      }
      await saveUserProfile(updated)
      themeCommitted.current = true
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card form-card" style={{ marginBottom: 'var(--space-5)' }}>
      <h3 style={{ marginTop: 0 }}>Profil bearbeiten</h3>

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

      <div className="field">
        <span>Farbdesign</span>
        <div className="theme-picker">
          {COLOR_THEMES.map((theme) => (
            <label
              key={theme.id}
              className={`theme-option${colorTheme === theme.id ? ' theme-option--active' : ''}`}
            >
              <input
                type="radio"
                name="colorTheme"
                value={theme.id}
                checked={colorTheme === theme.id}
                onChange={() => setColorTheme(theme.id)}
              />
              <span
                className="theme-option-swatch"
                style={{ background: `linear-gradient(135deg, ${theme.swatches[0]}, ${theme.swatches[1]})` }}
              />
              <span className="theme-option-label">
                {theme.label}
                <small>{theme.hint}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

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
