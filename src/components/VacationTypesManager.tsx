import { useState, type FormEvent } from 'react'
import type { UserProfile, VacationType } from '../types/models'
import { countDayEntriesWithStatus, saveUserProfile } from '../firebase/firestore'

interface Props {
  profile: UserProfile
  onUpdated: () => void
}

interface FormState {
  name: string
  totalDays: string
  rhythmEnabled: boolean
  maxPerPeriod: string
}

const EMPTY_FORM: FormState = { name: '', totalDays: '0', rhythmEnabled: false, maxPerPeriod: '1' }

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Erzeugt eine eindeutige id aus dem Namen, mit Zahlensuffix bei Kollision. */
function uniqueId(name: string, existing: VacationType[]): string {
  const base = slugify(name) || 'urlaubsart'
  const ids = new Set(existing.map((t) => t.id))
  if (!ids.has(base)) return base
  let i = 2
  while (ids.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

function typeToForm(type: VacationType): FormState {
  return {
    name: type.name,
    totalDays: String(type.totalDays),
    rhythmEnabled: type.rhythm?.kind === 'quarterly',
    maxPerPeriod: String(type.rhythm?.maxPerPeriod ?? 1),
  }
}

function formToRhythm(form: FormState): VacationType['rhythm'] {
  if (!form.rhythmEnabled) return undefined
  return { kind: 'quarterly', maxPerPeriod: Number(form.maxPerPeriod) || 1 }
}

export function VacationTypesManager({ profile, onUpdated }: Props) {
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockedDelete, setBlockedDelete] = useState<{ id: string; name: string; count: number } | null>(null)

  const persist = async (vacationTypes: VacationType[]) => {
    setSaving(true)
    setError(null)
    try {
      await saveUserProfile({ ...profile, vacationTypes })
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!addForm.name.trim()) return
    const rhythm = formToRhythm(addForm)
    const newType: VacationType = {
      id: uniqueId(addForm.name, profile.vacationTypes),
      name: addForm.name.trim(),
      totalDays: Number(addForm.totalDays) || 0,
      ...(rhythm ? { rhythm } : {}),
    }
    await persist([...profile.vacationTypes, newType])
    setAddForm(EMPTY_FORM)
  }

  const startEdit = (type: VacationType) => {
    setError(null)
    setBlockedDelete(null)
    setEditingId(type.id)
    setEditForm(typeToForm(type))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(EMPTY_FORM)
  }

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingId || !editForm.name.trim()) return
    const rhythm = formToRhythm(editForm)
    const updated = profile.vacationTypes.map((t): VacationType =>
      t.id === editingId
        ? {
            id: t.id,
            name: editForm.name.trim(),
            totalDays: Number(editForm.totalDays) || 0,
            ...(rhythm ? { rhythm } : {}),
          }
        : t,
    )
    await persist(updated)
    cancelEdit()
  }

  const handleDelete = async (type: VacationType) => {
    setError(null)
    setBlockedDelete(null)
    let count: number
    try {
      count = await countDayEntriesWithStatus(profile.uid, type.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return
    }
    if (count > 0) {
      setBlockedDelete({ id: type.id, name: type.name, count })
      return
    }
    if (!window.confirm(`Urlaubsart "${type.name}" wirklich löschen?`)) return
    await persist(profile.vacationTypes.filter((t) => t.id !== type.id))
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <h3 style={{ marginTop: 0 }}>Urlaubsarten verwalten</h3>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kontingent/Jahr</th>
              <th>Rhythmus</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {profile.vacationTypes.map((type) =>
              editingId === type.id ? (
                <tr key={type.id}>
                  <td colSpan={4}>
                    <form onSubmit={handleSaveEdit} className="inline-form">
                      <input
                        className="input"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                      />
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={editForm.totalDays}
                        onChange={(e) => setEditForm({ ...editForm, totalDays: e.target.value })}
                        style={{ width: 80 }}
                      />
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editForm.rhythmEnabled}
                          onChange={(e) => setEditForm({ ...editForm, rhythmEnabled: e.target.checked })}
                        />
                        max. pro Quartal
                      </label>
                      {editForm.rhythmEnabled && (
                        <input
                          className="input"
                          type="number"
                          min="1"
                          value={editForm.maxPerPeriod}
                          onChange={(e) => setEditForm({ ...editForm, maxPerPeriod: e.target.value })}
                          style={{ width: 60 }}
                        />
                      )}
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
                  <td>{type.name}</td>
                  <td>{type.totalDays}</td>
                  <td>{type.rhythm?.kind === 'quarterly' ? `max. ${type.rhythm.maxPerPeriod}/Quartal` : '–'}</td>
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
                    {blockedDelete?.id === type.id && (
                      <div className="form-warning" style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
                        Kann nicht gelöscht werden: {blockedDelete.count} Tageseintrag(e) mit dieser Urlaubsart
                        vorhanden. Erst diese Einträge ändern oder entfernen.
                      </div>
                    )}
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
          placeholder="Name (z. B. Dispositionstag)"
          value={addForm.name}
          onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
          required
        />
        <input
          className="input"
          type="number"
          min="0"
          placeholder="Tage/Jahr"
          value={addForm.totalDays}
          onChange={(e) => setAddForm({ ...addForm, totalDays: e.target.value })}
          style={{ width: 100 }}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={addForm.rhythmEnabled}
            onChange={(e) => setAddForm({ ...addForm, rhythmEnabled: e.target.checked })}
          />
          max. pro Quartal
        </label>
        {addForm.rhythmEnabled && (
          <input
            className="input"
            type="number"
            min="1"
            value={addForm.maxPerPeriod}
            onChange={(e) => setAddForm({ ...addForm, maxPerPeriod: e.target.value })}
            style={{ width: 60 }}
          />
        )}
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          Hinzufügen
        </button>
      </form>
    </div>
  )
}
