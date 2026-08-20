import { useEffect, useRef, useState } from 'react'
import type { ColorMode, ColorTheme, UserProfile } from '../types/models'
import {
  applyColorMode,
  applyColorTheme,
  COLOR_MODES,
  COLOR_THEMES,
  DEFAULT_COLOR_MODE,
  DEFAULT_COLOR_THEME,
} from '../lib/colorThemes'
import { saveUserProfile } from '../firebase/firestore'
import { useMediaQuery } from '../hooks/useMediaQuery'

interface Props {
  profile: UserProfile
  onSaved: () => void
}

/**
 * Eigene Sektion für Farbdesign (Issue #21) und Hell-/Dunkelmodus (Issue #41),
 * bewusst unten im Profilbereich, unter den Urlaubsarten.
 */
export function ColorThemeEditor({ profile, onSaved }: Props) {
  const [colorTheme, setColorTheme] = useState<ColorTheme>(profile.colorTheme ?? DEFAULT_COLOR_THEME)
  const [colorMode, setColorMode] = useState<ColorMode>(profile.colorMode ?? DEFAULT_COLOR_MODE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const committed = useRef(false)
  /* Speichern auf Mobile als Icon statt Text (Issue #63-Folgeticket). */
  const isMobile = useMediaQuery('(max-width: 639px)')

  // Direktvorschau: gewähltes Design/Modus sofort anwenden, beim Verlassen
  // ohne Speichern wieder auf den zuletzt gespeicherten Stand zurücksetzen.
  useEffect(() => {
    applyColorTheme(colorTheme)
  }, [colorTheme])

  useEffect(() => {
    applyColorMode(colorMode)
  }, [colorMode])

  useEffect(
    () => () => {
      if (!committed.current) {
        applyColorTheme(profile.colorTheme ?? DEFAULT_COLOR_THEME)
        applyColorMode(profile.colorMode ?? DEFAULT_COLOR_MODE)
      }
    },
    [profile.colorTheme, profile.colorMode],
  )

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveUserProfile({ ...profile, colorTheme, colorMode })
      committed.current = true
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

      <div className="field" style={{ marginTop: 'var(--space-4)' }}>
        <span>Hell-/Dunkelmodus</span>
        <div className="weekday-toggle-group">
          {COLOR_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`weekday-toggle${colorMode === mode.id ? ' weekday-toggle--active' : ''}`}
              aria-pressed={colorMode === mode.id}
              onClick={() => setColorMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} aria-label="Speichern">
          {isMobile ? '💾' : saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
