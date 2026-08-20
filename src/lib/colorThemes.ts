import type { ColorMode, ColorTheme } from '../types/models'

/** Metadaten der wählbaren Farbdesigns (Issue #21), für den Picker in ColorThemeEditor. */
export const COLOR_THEMES: { id: ColorTheme; label: string; hint: string; swatches: [string, string] }[] = [
  { id: 'lila', label: 'Lila', hint: 'Standarddesign', swatches: ['#7c3aed', '#f6f5fb'] },
  { id: 'rot-weiss', label: 'Rot/Weiß', hint: 'angelehnt an Swiss Life', swatches: ['#a11c36', '#faf7f7'] },
  { id: 'gelb-gruen', label: 'Gelb/Grün', hint: 'Gemeinde Unterhaching', swatches: ['#1f9d55', '#ffce00'] },
]

export const DEFAULT_COLOR_THEME: ColorTheme = 'lila'

/** Metadaten des wählbaren Hell-/Dunkelmodus (Issue #41), für den Picker in ColorThemeEditor. */
export const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: 'hell', label: 'Hell' },
  { id: 'dunkel', label: 'Dunkel' },
  { id: 'automatisch', label: 'Automatisch' },
]

export const DEFAULT_COLOR_MODE: ColorMode = 'automatisch'

const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)')
let currentColorMode: ColorMode = DEFAULT_COLOR_MODE

function resolveEffectiveMode(mode: ColorMode): 'hell' | 'dunkel' {
  return mode === 'automatisch' ? (systemPrefersDark.matches ? 'dunkel' : 'hell') : mode
}

/**
 * Setzt den Hell-/Dunkelmodus (data-mode fürs CSS, Issue #41). Bei
 * 'automatisch' gilt die Systemeinstellung, inkl. Live-Nachführung bei
 * deren Änderung während der Laufzeit (siehe matchMedia-Listener unten).
 * Setzt zusätzlich color-scheme, damit native Formularelemente/Scrollbars
 * auch bei erzwungenem Hell/Dunkel zum gewählten Modus passen statt der
 * Systemeinstellung zu folgen.
 */
export function applyColorMode(mode: ColorMode): void {
  currentColorMode = mode
  const effective = resolveEffectiveMode(mode)
  document.documentElement.dataset.mode = effective
  document.documentElement.style.colorScheme = effective === 'dunkel' ? 'dark' : 'light'
}

systemPrefersDark.addEventListener('change', () => {
  if (currentColorMode === 'automatisch') applyColorMode('automatisch')
})

// Sofort beim Laden des Moduls anwenden (Systemeinstellung), noch bevor das
// Nutzerprofil geladen ist — vermeidet einen Hell-Flackerer bei dunkler
// Systemeinstellung. App.tsx wendet den tatsächlich gespeicherten Modus an,
// sobald das Profil geladen ist.
applyColorMode(DEFAULT_COLOR_MODE)

/**
 * Setzt das Farbdesign (data-theme fürs CSS) und synchronisiert die
 * `<meta name="theme-color">` aus index.html mit der jeweiligen Primärfarbe
 * (swatches[0], identisch zu --color-primary je Design) — sonst bleibt die
 * Browser-/PWA-Titelleiste immer beim hart codierten Lila-Standardwert.
 */
export function applyColorTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  const primary = COLOR_THEMES.find((t) => t.id === theme)?.swatches[0]
  if (meta && primary) meta.setAttribute('content', primary)
}
