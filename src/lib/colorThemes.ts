import type { ColorTheme } from '../types/models'

/** Metadaten der wählbaren Farbdesigns (Issue #21), für den Picker in ProfileEditor. */
export const COLOR_THEMES: { id: ColorTheme; label: string; hint: string; swatches: [string, string] }[] = [
  { id: 'lila', label: 'Lila', hint: 'Standarddesign', swatches: ['#7c3aed', '#f6f5fb'] },
  { id: 'rot-weiss', label: 'Rot/Weiß', hint: 'angelehnt an Swiss Life', swatches: ['#a11c36', '#faf7f7'] },
  { id: 'gelb-gruen', label: 'Gelb/Grün', hint: 'Gemeinde Unterhaching', swatches: ['#1f9d55', '#ffce00'] },
]

export const DEFAULT_COLOR_THEME: ColorTheme = 'lila'
