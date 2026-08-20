import type { AgFreierTag } from '../types/models'
import { toIsoDate } from './dates'

/** Bezeichnung des passenden AG-freien Tages (Issue #37), falls `date` einem der wiederkehrenden Einträge entspricht. */
export function getAgFreierTagName(date: Date, agFreieTage: readonly AgFreierTag[]): string | undefined {
  const monthDay = toIsoDate(date).slice(5)
  return agFreieTage.find((t) => t.tag === monthDay)?.bezeichnung
}
