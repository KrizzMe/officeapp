import { useState, type FormEvent } from 'react'
import type { AgFreierTag, UserProfile } from '../types/models'
import { saveUserProfile } from '../firebase/firestore'

interface Props {
  profile: UserProfile
  onUpdated: () => void
}

interface FormState {
  /** ISO-Datum mit fixem (Schalt-)Jahr, nur für den <input type="date">-Wert — gespeichert wird nur Tag+Monat. */
  datum: string
  bezeichnung: string
}

/** Beliebiges Schaltjahr, damit auch der 29.02. wählbar ist; das Jahr selbst wird nie gespeichert. */
const DUMMY_YEAR = 2024
const EMPTY_FORM: FormState = { datum: `${DUMMY_YEAR}-12-24`, bezeichnung: '' }

function tagToFormDate(tag: string): string {
  return `${DUMMY_YEAR}-${tag}`
}

function formDateToTag(datum: string): string {
  return datum.slice(5)
}

function formatTag(tag: string): string {
  const [month, day] = tag.split('-')
  return `${day}.${month}.`
}

function typeToForm(type: AgFreierTag): FormState {
  return { datum: tagToFormDate(type.tag), bezeichnung: type.bezeichnung }
}

/** Verwaltung zusätzlicher AG-freier Tage (Issue #37) — wiederkehrend jedes Jahr, analog zu VacationTypesManager. */
export function AgFreieTageManager({ profile, onUpdated }: Props) {
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      tag: formDateToTag(addForm.datum),
      bezeichnung: addForm.bezeichnung.trim(),
    }
    await persist([...agFreieTage, newTag])
    setAddForm(EMPTY_FORM)
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
      t.id === editingId ? { id: t.id, tag: formDateToTag(editForm.datum), bezeichnung: editForm.bezeichnung.trim() } : t,
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
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((type) =>
              editingId === type.id ? (
                <tr key={type.id}>
                  <td colSpan={3}>
                    <form onSubmit={handleSaveEdit} className="inline-form">
                      <input
                        className="input"
                        type="date"
                        value={editForm.datum}
                        onChange={(e) => setEditForm({ ...editForm, datum: e.target.value })}
                        required
                      />
                      <input
                        className="input"
                        placeholder="Bezeichnung (z. B. Heiligabend)"
                        value={editForm.bezeichnung}
                        onChange={(e) => setEditForm({ ...editForm, bezeichnung: e.target.value })}
                        required
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                        Speichern
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit}>
                        Abbrechen
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={type.id}>
                  <td>{formatTag(type.tag)}</td>
                  <td>{type.bezeichnung}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="form-row" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(type)}>
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(type)}
                        disabled={saving}
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAdd} className="inline-form">
        <input
          className="input"
          type="date"
          value={addForm.datum}
          onChange={(e) => setAddForm({ ...addForm, datum: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Bezeichnung (z. B. Heiligabend)"
          value={addForm.bezeichnung}
          onChange={(e) => setAddForm({ ...addForm, bezeichnung: e.target.value })}
          required
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          Hinzufügen
        </button>
      </form>
    </div>
  )
}
