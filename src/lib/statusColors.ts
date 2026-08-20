import { DEFAULT_VACATION_TYPE_IDS, type DayStatus, type VacationType } from '../types/models'

interface StatusVisual {
  color: string
  icon: string
  /** Grün schraffiert statt einfarbig darstellen, um Resturlaub von anderen Urlaubsarten abzuheben (Issue #32). */
  hatched?: boolean
}

const BASE_VISUALS: Record<string, StatusVisual> = {
  buero: { color: 'var(--status-buero)', icon: '🏢' },
  homeoffice: { color: 'var(--status-homeoffice)', icon: '🏠' },
  dienstreise: { color: 'var(--status-dienstreise)', icon: '✈️' },
  krank: { color: 'var(--status-krank)', icon: '🤒' },
  'kind-krank': { color: 'var(--status-kind-krank)', icon: '🤧' },
}

const VACATION_PALETTE = [
  'var(--status-vacation-1)',
  'var(--status-vacation-2)',
  'var(--status-vacation-3)',
  'var(--status-vacation-4)',
  'var(--status-vacation-5)',
  'var(--status-vacation-6)',
]

/** Stabiler Hash, damit eine Urlaubsart-id immer dieselbe Palettenfarbe bekommt. */
function paletteIndex(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return hash % VACATION_PALETTE.length
}

/** Farbe (als CSS-Wert) und Icon fuer einen Tagesstatus, inkl. frei definierter Urlaubsarten. */
export function statusVisual(status: DayStatus): StatusVisual {
  const base = BASE_VISUALS[status]
  if (base) return base
  if (status === DEFAULT_VACATION_TYPE_IDS.resturlaub) {
    return { color: 'var(--status-resturlaub)', icon: '🌴', hatched: true }
  }
  return { color: VACATION_PALETTE[paletteIndex(status)], icon: '🌴' }
}

export function statusColor(status: DayStatus): string {
  return statusVisual(status).color
}

export function vacationTypeColor(type: VacationType): string {
  return statusVisual(type.id).color
}
