import type { ColorTheme } from '../types/models'

/** Metadaten der wählbaren Farbdesigns (Issue #21), für den Picker in ColorThemeEditor. */
export const COLOR_THEMES: { id: ColorTheme; label: string; hint: string; swatches: [string, string] }[] = [
  { id: 'lila', label: 'Lila', hint: 'Standarddesign', swatches: ['#7c3aed', '#f6f5fb'] },
  { id: 'rot-weiss', label: 'Rot/Weiß', hint: 'angelehnt an Swiss Life', swatches: ['#a11c36', '#faf7f7'] },
  { id: 'gelb-gruen', label: 'Gelb/Grün', hint: 'Gemeinde Unterhaching', swatches: ['#1f9d55', '#ffce00'] },
]

export const DEFAULT_COLOR_THEME: ColorTheme = 'lila'

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
