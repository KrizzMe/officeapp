import { useEffect, useRef, useState } from 'react'
import type { ColorTheme, UserProfile } from '../types/models'
import { applyColorTheme, COLOR_THEMES, DEFAULT_COLOR_THEME } from '../lib/colorThemes'
import { saveUserProfile } from '../firebase/firestore'

interface Props {
  profile: UserProfile
  onSaved: () => void
}

/** Eigene Sektion für das Farbdesign (Issue #21), bewusst unten im Profilbereich, unter den Urlaubsarten. */
export function ColorThemeEditor({ profile, onSaved }: Props) {
  const [colorTheme, setColorTheme] = useState<ColorTheme>(profile.colorTheme ?? DEFAULT_COLOR_THEME)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const themeCommitted = useRef(false)

  // Direktvorschau: gewähltes Design sofort anwenden, beim Verlassen ohne
  // Speichern wieder auf das aktuell gespeicherte Design zurücksetzen.
  useEffect(() => {
    applyColorTheme(colorTheme)
  }, [colorTheme])

  useEffect(
    () => () => {
      if (!themeCommitted.current) {
        applyColorTheme(profile.colorTheme ?? DEFAULT_COLOR_THEME)
      }
    },
    [profile.colorTheme],
  )

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveUserProfile({ ...profile, colorTheme })
      themeCommitted.current = true
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card form-card form-card--wide" style={{ marginBottom: 'var(--space-5)' }}>
      <h3 style={{ marginTop: 0 }}>Farbdesign</h3>

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

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
