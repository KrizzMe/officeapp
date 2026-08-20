import { useState, type FormEvent } from 'react'
import type { AgFreierTag, UserProfile } from '../types/models'
import { saveUserProfile } from '../firebase/firestore'
import { MONTH_LABELS } from '../lib/dates'
import { useMediaQuery } from '../hooks/useMediaQuery'

interface Props {
  profile: UserProfile
  onUpdated: () => void
}

interface FormState {
  monat: number
  tagDesMonats: number
  bezeichnung: string
}

const EMPTY_FORM: FormState = { monat: 12, tagDesMonats: 24, bezeichnung: '' }

/** Anzahl Tage in `monat` (1-12), Schaltjahr als Referenz, damit auch der 29.02. wählbar ist. */
function daysInMonth(monat: number): number {
  return new Date(2024, monat, 0).getDate()
}

function toTag(monat: number, tagDesMonats: number): string {
  return `${String(monat).padStart(2, '0')}-${String(tagDesMonats).padStart(2, '0')}`
}

function parseTag(tag: string): { monat: number; tagDesMonats: number } {
  const [monat, tagDesMonats] = tag.split('-').map(Number)
  return { monat, tagDesMonats }
}

function formatTag(tag: string): string {
  const [month, day] = tag.split('-')
  return `${day}.${month}.`
}

function typeToForm(type: AgFreierTag): FormState {
  return { ...parseTag(type.tag), bezeichnung: type.bezeichnung }
}

interface TagMonatFieldsProps {
  form: FormState
  onChange: (form: FormState) => void
}

/** Tag+Monat-Auswahl ohne Jahr (Issue #37) — natives type="date" erzwingt immer ein Jahr, daher zwei Dropdowns. */
function TagMonatFields({ form, onChange }: TagMonatFieldsProps) {
  const maxDay = daysInMonth(form.monat)

  return (
    <>
      <select
        className="input"
        value={form.tagDesMonats}
        onChange={(e) => onChange({ ...form, tagDesMonats: Number(e.target.value) })}
        style={{ width: 70 }}
      >
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <select
        className="input"
        value={form.monat}
        onChange={(e) => {
          const monat = Number(e.target.value)
          onChange({ ...form, monat, tagDesMonats: Math.min(form.tagDesMonats, daysInMonth(monat)) })
        }}
      >
        {MONTH_LABELS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
    </>
  )
}

/** Verwaltung zusätzlicher AG-freier Tage (Issue #37) — wiederkehrend jedes Jahr, analog zu VacationTypesManager. */
export function AgFreieTageManager({ profile, onUpdated }: Props) {
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /*
   * Löschen ist nur noch im Bearbeitungsmodus erreichbar (analog
   * VacationTypesManager, Issue #63-Folgeticket). Auf Mobile zeigen
   * Bearbeiten/Speichern/Abbrechen/Löschen dort nur ihr Icon statt Text.
   */
  const isMobile = useMediaQuery('(max-width: 639px)')

  const agFreieTage = profile.agFreieTage ?? []
  const sorted = [...agFreieTage].sort((a, b) => a.tag.localeCompare(b.tag))

  const persist = async (updated: AgFreierTag[]) => {
    setSaving(true)
    setError(null)
    try {
      await saveUserProfile({ ...profile, agFreieTage: updated })
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!addForm.bezeichnung.trim()) return
    const newTag: AgFreierTag = {
      id: crypto.randomUUID(),
      tag: toTag(addForm.monat, addForm.tagDesMonats),
      bezeichnung: addForm.bezeichnung.trim(),
    }
    await persist([...agFreieTage, newTag])
    setAddForm(EMPTY_FORM)
    setIsAdding(false)
  }

  const cancelAdd = () => {
    setAddForm(EMPTY_FORM)
    setIsAdding(false)
  }

  const startEdit = (type: AgFreierTag) => {
    setError(null)
    setEditingId(type.id)
    setEditForm(typeToForm(type))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(EMPTY_FORM)
  }

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingId || !editForm.bezeichnung.trim()) return
    const updated = agFreieTage.map((t): AgFreierTag =>
      t.id === editingId
        ? { id: t.id, tag: toTag(editForm.monat, editForm.tagDesMonats), bezeichnung: editForm.bezeichnung.trim() }
        : t,
    )
    await persist(updated)
    cancelEdit()
  }

  const handleDelete = async (type: AgFreierTag) => {
    setError(null)
    if (!window.confirm(`AG-freien Tag "${type.bezeichnung}" (${formatTag(type.tag)}) wirklich löschen?`)) return
    await persist(agFreieTage.filter((t) => t.id !== type.id))
  }

  return (
    <div className="card form-card--wide" style={{ marginBottom: 'var(--space-5)' }}>
      <h3 style={{ marginTop: 0 }}>AG-freie Tage verwalten</h3>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Zusätzliche arbeitsfreie Tage bei deinem Arbeitgeber (z. B. durch Betriebsvereinbarung), die jedes Jahr am
        gleichen Datum gelten — z. B. 24.12. und 31.12. Werden wie gesetzliche Feiertage behandelt: automatisch frei,
        nicht manuell überschreibbar.
      </p>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Bezeichnung</th>
              <th style={{ textAlign: 'right' }}>
                {!isAdding && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsAdding(true)} aria-label="Hinzufügen">
                    {isMobile ? '+' : 'Hinzufügen'}
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((type) =>
              editingId === type.id ? (
                <tr key={type.id}>
                  <td colSpan={3}>
                    <form onSubmit={handleSaveEdit} className="inline-form">
                      <TagMonatFields form={editForm} onChange={setEditForm} />
                      <input
                        className="input"
                        placeholder="Bezeichnung (z. B. Heiligabend)"
                        value={editForm.bezeichnung}
                        onChange={(e) => setEditForm({ ...editForm, bezeichnung: e.target.value })}
                        required
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={saving} aria-label="Speichern">
                        {isMobile ? '💾' : 'Speichern'}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit} aria-label="Abbrechen">
                        {isMobile ? '❌' : 'Abbrechen'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(type)}
                        disabled={saving}
                        aria-label="Löschen"
                      >
                        {isMobile ? '🗑️' : 'Löschen'}
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={type.id}>
                  <td>{formatTag(type.tag)}</td>
                  <td>{type.bezeichnung}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => startEdit(type)}
                      aria-label="Bearbeiten"
                    >
                      {isMobile ? '✏️' : 'Bearbeiten'}
                    </button>
                  </td>
                </tr>
              ),
            )}
            {isAdding && (
              <tr>
                <td colSpan={3}>
                  <form onSubmit={handleAdd} className="inline-form">
                    <TagMonatFields form={addForm} onChange={setAddForm} />
                    <input
                      className="input"
                      placeholder="Bezeichnung (z. B. Heiligabend)"
                      value={addForm.bezeichnung}
                      onChange={(e) => setAddForm({ ...addForm, bezeichnung: e.target.value })}
                      required
                    />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving} aria-label="Speichern">
                      {isMobile ? '💾' : 'Speichern'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={cancelAdd} aria-label="Abbrechen">
                      {isMobile ? '❌' : 'Abbrechen'}
                    </button>
                  </form>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
