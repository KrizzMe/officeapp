import type { DayStatus, VacationType } from '../types/models'
import type { StatusOption } from '../components/Calendar/StatusDropdown'

const STATUS_LABELS: Record<string, string> = {
  buero: 'Büro',
  homeoffice: 'Homeoffice',
  dienstreise: 'Dienstreise',
  krank: 'Krank',
  'kind-krank': 'Kind krank',
}

export function statusLabel(id: DayStatus, vacationTypes: VacationType[]): string {
  return STATUS_LABELS[id] ?? vacationTypes.find((v) => v.id === id)?.name ?? id
}

/**
 * Baut die im Status-Dropdown wählbaren Optionen (Basis-Status + Urlaubsarten),
 * gemeinsam genutzt von MonthGrid (Monatsübersicht) und HomeDashboard.
 */
export function buildStatusOptions(
  vacationTypes: VacationType[],
  homeofficeErlaubt: boolean,
  currentStatusId?: string,
): StatusOption[] {
  const options: StatusOption[] = [{ value: 'buero', icon: '🏢', label: statusLabel('buero', vacationTypes) }]
  if (homeofficeErlaubt || currentStatusId === 'homeoffice') {
    options.push({ value: 'homeoffice', icon: '🏠', label: statusLabel('homeoffice', vacationTypes) })
  }
  options.push(
    { value: 'dienstreise', icon: '✈️', label: statusLabel('dienstreise', vacationTypes) },
    { value: 'krank', icon: '🤒', label: statusLabel('krank', vacationTypes) },
    { value: 'kind-krank', icon: '🤧', label: statusLabel('kind-krank', vacationTypes) },
  )
  for (const v of vacationTypes) {
    options.push({ value: v.id, icon: '🌴', label: statusLabel(v.id, vacationTypes) })
  }
  return options
}
