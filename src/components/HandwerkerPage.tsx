import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import type { HandwerkerBeleg, UserProfile } from '../types/models'
import { useHandwerkerBelege } from '../hooks/useBelege'
import { useBelegScan } from '../hooks/useBelegScan'
import { BelegScanBox } from './BelegScanBox'
import { materialkostenAusScan, type BelegScanResult } from '../lib/belegScan'
import { belegDateiname, belegZiel, normalizePfad } from '../lib/belegOrdner'
import { deleteHandwerkerBeleg, saveHandwerkerBeleg } from '../firebase/firestore'
import { MONTH_LABELS } from '../lib/dates'
import {
  berechneHandwerker,
  formatDatum,
  formatEuro,
  HANDWERKER_ERMAESSIGUNG_MAX,
  MWST_FAKTOR,
  summeJeMonat,
  summiereHandwerker,
} from '../lib/steuern'

interface Props {
  user: User
  profile: UserProfile
}

interface FormState {
  reDatum: string
  leistungsZeitraum: string
  leistung: string
  firma: string
  rechnungsnummer: string
  rechnungsbetrag: string
  materialkosten: string
  belegRef: string
}

const EMPTY_FORM: FormState = {
  reDatum: '',
  leistungsZeitraum: '',
  leistung: '',
  firma: '',
  rechnungsnummer: '',
  rechnungsbetrag: '',
  materialkosten: '0',
  belegRef: '',
}

function belegToForm(b: HandwerkerBeleg): FormState {
  return {
    reDatum: b.reDatum,
    leistungsZeitraum: b.leistungsZeitraum ?? '',
    leistung: b.leistung,
    firma: b.firma,
    rechnungsnummer: b.rechnungsnummer ?? '',
    rechnungsbetrag: String(b.rechnungsbetrag),
    materialkosten: String(b.materialkosten),
    belegRef: b.belegRef ?? '',
  }
}

/** Handwerkerleistungen (Issue #10): Rechnungen erfassen, Arbeitskosten und Steuerermäßigung (§ 35a EStG) berechnen. */
export function HandwerkerPage({ user, profile }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const { belege, loading, error: loadError } = useHandwerkerBelege(user.uid, year)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const scan = useBelegScan(user, normalizePfad(profile.belegBasisPfad))
  const [scanHint, setScanHint] = useState<string | null>(null)
  // Rechnungsliste standardmäßig eingeklappt; Summen-Kacheln oben bleiben sichtbar.
  const [listOpen, setListOpen] = useState(false)

  // Beim Bearbeiten eines weit unten stehenden Eintrags zum Formular springen.
  useEffect(() => {
    if (!formOpen) return
    // Nach dem Rendern scrollen, sofort statt animiert (eine Animation wird von Layout-Änderungen leicht abgebrochen).
    const frame = requestAnimationFrame(() => {
      const form = formRef.current
      if (!form) return
      form.scrollIntoView({ behavior: 'auto', block: 'start' })
      form.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [formOpen, editingId])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const summe = useMemo(() => summiereHandwerker(belege), [belege])
  const monatlich = useMemo(() => summeJeMonat(belege, (b) => berechneHandwerker(b).handwerkerleistungBrutto), [belege])

  const preview = useMemo(() => {
    const rechnungsbetrag = Number(form.rechnungsbetrag)
    const materialkosten = Number(form.materialkosten) || 0
    if (!form.rechnungsbetrag || Number.isNaN(rechnungsbetrag)) return null
    return berechneHandwerker({ rechnungsbetrag, materialkosten })
  }, [form.rechnungsbetrag, form.materialkosten])

  /** Foto aufnehmen/wählen, auslesen und die erkannten Werte ins Formular übernehmen (Issue #79). */
  const applyScan = (result: BelegScanResult | null) => {
    if (!result) return
    setForm((f) => ({
      ...f,
      reDatum: result.datum ?? f.reDatum,
      leistung: result.beschreibung ?? f.leistung,
      firma: result.aussteller ?? f.firma,
      rechnungsnummer: result.rechnungsnummer ?? f.rechnungsnummer,
      leistungsZeitraum: result.leistungszeitraum ?? f.leistungsZeitraum,
      rechnungsbetrag: result.bruttoBetrag !== null ? String(result.bruttoBetrag) : f.rechnungsbetrag,
      materialkosten:
        result.bruttoBetrag !== null || result.materialkostenNetto !== null
          ? String(materialkostenAusScan(result, MWST_FAKTOR))
          : f.materialkosten,
    }))
    const hints: string[] = []
    if (result.art === 'werbungskosten') hints.push('Der Beleg sieht eher nach Werbungskosten als nach einer Handwerkerleistung aus.')
    if (result.art === 'unklar') hints.push('Der Beleg konnte nicht sicher als Rechnung erkannt werden — bitte alle Werte prüfen.')
    if (result.mwstBetrag !== null) hints.push(`MwSt. laut Beleg: ${formatEuro(result.mwstBetrag)}.`)
    if (result.arbeitskostenNetto !== null && result.materialkostenNetto === null && result.bruttoBetrag === null) {
      hints.push(`Arbeitskosten netto laut Beleg: ${formatEuro(result.arbeitskostenNetto)}.`)
    }
    setScanHint(hints.length > 0 ? hints.join(' ') : null)
  }

  const handleScanFiles = async (files: File[]) => {
    setScanHint(null)
    applyScan(await scan.addFiles(files))
  }

  const handleScanPhotos = async () => {
    setScanHint(null)
    applyScan(await scan.scanPhotos())
  }

  const closeForm = () => {
    scan.clear()
    setScanHint(null)
    setForm(EMPTY_FORM)
    setEditingId(null)
    setFormOpen(false)
    setError(null)
  }

  const startAdd = () => {
    setForm({ ...EMPTY_FORM, reDatum: `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01` })
    setEditingId(null)
    setFormOpen(true)
  }

  const startEdit = (b: HandwerkerBeleg) => {
    setForm(belegToForm(b))
    setEditingId(b.id)
    setFormOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const rechnungsbetrag = Number(form.rechnungsbetrag)
    const materialkosten = Number(form.materialkosten) || 0
    if (Number.isNaN(rechnungsbetrag) || rechnungsbetrag < 0 || materialkosten < 0) {
      setError('Bitte gültige, nicht negative Beträge eingeben.')
      return
    }
    const beleg: HandwerkerBeleg = {
      id: editingId ?? crypto.randomUUID(),
      reDatum: form.reDatum,
      leistung: form.leistung.trim(),
      firma: form.firma.trim(),
      rechnungsbetrag,
      materialkosten,
    }
    if (form.rechnungsnummer.trim()) beleg.rechnungsnummer = form.rechnungsnummer.trim()
    if (form.leistungsZeitraum.trim()) beleg.leistungsZeitraum = form.leistungsZeitraum.trim()
    if (form.belegRef.trim()) beleg.belegRef = form.belegRef.trim()

    setSaving(true)
    setError(null)
    try {
      if (scan.pending) {
        // Beleg erst jetzt, nach der Prüfung durch den Nutzer, nach OneDrive: <Stamm>/<Jahr>/<Ordner>/JJJJ.MM.TT_<Firma>-<Leistung>.<jpg|pdf>
        const belegJahr = /^\d{4}/.test(beleg.reDatum) ? beleg.reDatum.slice(0, 4) : String(year)
        const fileName = belegDateiname('handwerker', beleg.reDatum, beleg, scan.pending.extension)
        try {
          const uploaded = await scan.upload(belegZiel(profile, belegJahr, 'handwerker'), fileName)
          if (uploaded) beleg.belegRef = uploaded.webUrl
        } catch (err) {
          setError(
            `Upload nach OneDrive fehlgeschlagen: ${err instanceof Error ? err.message : String(err)} — nichts wurde gespeichert. Erneut „Speichern“ versucht den Upload nochmal; ohne Beleg („Beleg entfernen“) wird nur der Eintrag gespeichert.`,
          )
          return
        }
      }
      await saveHandwerkerBeleg(user.uid, beleg)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (b: HandwerkerBeleg) => {
    if (!window.confirm(`Rechnung "${b.leistung}" (${b.firma}) wirklich löschen?`)) return
    setError(null)
    try {
      await deleteHandwerkerBeleg(user.uid, b.id)
      if (editingId === b.id) closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <div className="month-nav">
        <button className="btn btn-secondary btn-sm" onClick={() => setYear((y) => y - 1)}>
          ← Vorjahr
        </button>
        <h2>Handwerkerleistungen {year}</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => setYear((y) => y + 1)}>
          Folgejahr →
        </button>
      </div>

      <div className="card-grid">
        <div className="card stat-tile">
          <span className="stat-label">Rechnungen gesamt</span>
          <span className="stat-value">{formatEuro(summe.rechnungsbetrag)}</span>
          <span className="stat-sub">{belege.length} Beleg(e), brutto</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">Arbeitskosten (inkl. MwSt)</span>
          <span className="stat-value">{formatEuro(summe.handwerkerleistungBrutto)}</span>
          <span className="stat-sub">netto {formatEuro(summe.handwerkerleistung)}</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">Steuerermäßigung (20 %)</span>
          <span className="stat-value is-positive">{formatEuro(summe.ermaessigung)}</span>
          <span className="stat-sub">
            Richtwert, max. {formatEuro(HANDWERKER_ERMAESSIGUNG_MAX)} pro Jahr (§ 35a EStG)
          </span>
        </div>
      </div>

      <div className="card form-card--wide" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="info-details-toggle"
            aria-expanded={listOpen}
            onClick={() => setListOpen((o) => !o)}
          >
            <span className={listOpen ? 'info-details-arrow is-open' : 'info-details-arrow'} aria-hidden="true">
              ▸
            </span>
            <h3 style={{ margin: 0 }}>Rechnungen ({belege.length})</h3>
          </button>
          {!formOpen && (
            <button type="button" className="btn btn-primary btn-sm" onClick={startAdd}>
              Hinzufügen
            </button>
          )}
        </div>

        {(error || loadError) && <p className="form-error">{error ?? loadError}</p>}

        {formOpen && (
          <form ref={formRef} onSubmit={handleSubmit} className="beleg-form">
            <BelegScanBox
              scan={scan}
              onFiles={(files) => void handleScanFiles(files)}
              onScanPhotos={() => void handleScanPhotos()}
              hint={scanHint}
            />
            <label className="field">
              <span>Rechnungsdatum</span>
              <input
                className="input"
                type="date"
                value={form.reDatum}
                onChange={(e) => setForm({ ...form, reDatum: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Leistungszeitraum</span>
              <input
                className="input"
                value={form.leistungsZeitraum}
                onChange={(e) => setForm({ ...form, leistungsZeitraum: e.target.value })}
                placeholder="z. B. 03.–05.2026"
              />
            </label>
            <label className="field">
              <span>Leistung</span>
              <input
                className="input"
                value={form.leistung}
                onChange={(e) => setForm({ ...form, leistung: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Firma</span>
              <input
                className="input"
                value={form.firma}
                onChange={(e) => setForm({ ...form, firma: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Rechnungsnummer (optional)</span>
              <input
                className="input"
                value={form.rechnungsnummer}
                onChange={(e) => setForm({ ...form, rechnungsnummer: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Rechnungsbetrag brutto (€)</span>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={form.rechnungsbetrag}
                onChange={(e) => setForm({ ...form, rechnungsbetrag: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Materialkosten netto (€)</span>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={form.materialkosten}
                onChange={(e) => setForm({ ...form, materialkosten: e.target.value })}
              />
            </label>
            <label className="field beleg-form-wide">
              <span>Beleg-Verweis (optional, Link zur Rechnung im Cloud-Speicher)</span>
              <input
                className="input"
                value={form.belegRef}
                onChange={(e) => setForm({ ...form, belegRef: e.target.value })}
                placeholder="https://…"
              />
            </label>
            {preview && (
              <p className="form-hint beleg-form-wide" style={{ marginTop: 0 }}>
                Netto {formatEuro(preview.netto)} · Arbeitskosten netto {formatEuro(preview.handwerkerleistung)} ·
                Arbeitskosten inkl. MwSt {formatEuro(preview.handwerkerleistungBrutto)}
                {preview.handwerkerleistung < 0 && ' — Achtung: Material übersteigt den Netto-Rechnungsbetrag.'}
              </p>
            )}
            <div className="inline-form-actions beleg-form-wide">
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                Speichern
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeForm}>
                Abbrechen
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={saving}
                  onClick={() => {
                    const b = belege.find((x) => x.id === editingId)
                    if (b) void handleDelete(b)
                  }}
                >
                  Löschen
                </button>
              )}
            </div>
          </form>
        )}

        {listOpen && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Leistung</th>
                <th>Firma</th>
                <th style={{ textAlign: 'right' }}>Rechnung</th>
                <th style={{ textAlign: 'right' }}>Netto</th>
                <th style={{ textAlign: 'right' }}>Material</th>
                <th style={{ textAlign: 'right' }}>Arbeit netto</th>
                <th style={{ textAlign: 'right' }}>Arbeit inkl. MwSt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {belege.map((b) => {
                const c = berechneHandwerker(b)
                return (
                  <tr key={b.id}>
                    <td>{formatDatum(b.reDatum)}</td>
                    <td>
                      {b.leistung}
                      {b.leistungsZeitraum && <div className="stat-sub">{b.leistungsZeitraum}</div>}
                      {b.rechnungsnummer && <div className="stat-sub">Nr. {b.rechnungsnummer}</div>}
                      {b.belegRef && (
                        <div className="stat-sub">
                          <a href={b.belegRef} target="_blank" rel="noreferrer noopener">
                            Beleg öffnen
                          </a>
                        </div>
                      )}
                    </td>
                    <td>{b.firma}</td>
                    <td style={{ textAlign: 'right' }}>{formatEuro(b.rechnungsbetrag)}</td>
                    <td style={{ textAlign: 'right' }}>{formatEuro(c.netto)}</td>
                    <td style={{ textAlign: 'right' }}>{formatEuro(b.materialkosten)}</td>
                    <td style={{ textAlign: 'right' }}>{formatEuro(c.handwerkerleistung)}</td>
                    <td style={{ textAlign: 'right' }}>{formatEuro(c.handwerkerleistungBrutto)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(b)}>
                        Bearbeiten
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!loading && belege.length === 0 && (
                <tr>
                  <td colSpan={9} className="form-hint">
                    Für {year} sind noch keine Rechnungen erfasst.
                  </td>
                </tr>
              )}
            </tbody>
            {belege.length > 0 && (
              <tfoot>
                <tr>
                  <th colSpan={3}>Summe</th>
                  <th style={{ textAlign: 'right' }}>{formatEuro(summe.rechnungsbetrag)}</th>
                  <th style={{ textAlign: 'right' }}>{formatEuro(summe.netto)}</th>
                  <th style={{ textAlign: 'right' }}>{formatEuro(summe.materialkosten)}</th>
                  <th style={{ textAlign: 'right' }}>{formatEuro(summe.handwerkerleistung)}</th>
                  <th style={{ textAlign: 'right' }}>{formatEuro(summe.handwerkerleistungBrutto)}</th>
                  <th />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}
      </div>

      <div className="card form-card--wide">
        <details className="info-details">
          <summary>
            <h3>Monatsübersicht (Arbeitskosten inkl. MwSt)</h3>
          </summary>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Monat</th>
                <th style={{ textAlign: 'right' }}>Betrag</th>
              </tr>
            </thead>
            <tbody>
              {MONTH_LABELS.map((label, i) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td style={{ textAlign: 'right' }}>{formatEuro(monatlich[i + 1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </details>
      </div>
    </>
  )
}
