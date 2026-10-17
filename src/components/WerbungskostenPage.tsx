import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile, WerbungskostenBeleg } from '../types/models'
import { useWerbungskostenBelege } from '../hooks/useBelege'
import { useBelegScan } from '../hooks/useBelegScan'
import { BelegScanBox } from './BelegScanBox'
import { safeName } from '../lib/onedrive'
import { deleteWerbungskostenBeleg, saveWerbungskostenBeleg, updateUserProfile } from '../firebase/firestore'
import { MONTH_LABELS } from '../lib/dates'
import {
  formatDatum,
  formatEuro,
  kategorienForYear,
  STANDARD_KATEGORIE,
  summeJeKategorie,
  summeJeMonat,
} from '../lib/steuern'

interface Props {
  user: User
  profile: UserProfile
  onProfileUpdated: () => void
}

interface FormState {
  reDatum: string
  artikel: string
  kategorie: string
  betrag: string
  shop: string
  rechnungsnummer: string
  belegRef: string
}

const EMPTY_FORM: FormState = {
  reDatum: '',
  artikel: '',
  kategorie: '',
  betrag: '',
  shop: '',
  rechnungsnummer: '',
  belegRef: '',
}

function belegToForm(b: WerbungskostenBeleg): FormState {
  return {
    reDatum: b.reDatum,
    artikel: b.artikel,
    kategorie: b.kategorie,
    betrag: String(b.betrag),
    shop: b.shop ?? '',
    rechnungsnummer: b.rechnungsnummer ?? '',
    belegRef: b.belegRef ?? '',
  }
}

/** Werbungskosten (Issue #10): Belege mit Kategorie erfassen, Summen je Monat und Kategorie. */
export function WerbungskostenPage({ user, profile, onProfileUpdated }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const { belege, loading, error: loadError } = useWerbungskostenBelege(user.uid, year)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const scan = useBelegScan(user)
  const [scanHint, setScanHint] = useState<string | null>(null)
  // Belegliste standardmäßig eingeklappt; Summen und Kategorie-Kacheln oben bleiben sichtbar.
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

  const gesamt = useMemo(() => belege.reduce((s, b) => s + b.betrag, 0), [belege])
  const jeKategorie = useMemo(() => summeJeKategorie(belege), [belege])
  const monatlich = useMemo(() => summeJeMonat(belege, (b) => b.betrag), [belege])
  const kategorien = useMemo(() => kategorienForYear(profile, year), [profile, year])
  const [newKategorie, setNewKategorie] = useState('')
  const [kategorienError, setKategorienError] = useState<string | null>(null)
  // Belege mit einer nicht (mehr) gepflegten Kategorie bleiben im Dropdown auswählbar.
  const formKategorien =
    form.kategorie && !kategorien.includes(form.kategorie) ? [...kategorien, form.kategorie] : kategorien

  const persistKategorien = async (updated: string[]) => {
    setKategorienError(null)
    try {
      // Dotted Path: schreibt nur das gewählte Jahr, nicht die Kategorien anderer Jahre.
      await updateUserProfile(profile.uid, {
        [`werbungskostenKategorienByYear.${year}`]: updated,
      } as Partial<UserProfile>)
      onProfileUpdated()
    } catch (err) {
      setKategorienError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAddKategorie = async (e: FormEvent) => {
    e.preventDefault()
    const name = newKategorie.trim()
    if (!name) return
    if (kategorien.some((k) => k.toLowerCase() === name.toLowerCase())) {
      setKategorienError(`Kategorie "${name}" existiert bereits.`)
      return
    }
    await persistKategorien([...kategorien, name])
    setNewKategorie('')
  }

  const handleDeleteKategorie = async (name: string) => {
    if (name === STANDARD_KATEGORIE) return
    const betroffen = belege.filter((b) => b.kategorie === name)
    if (
      betroffen.length > 0 &&
      !window.confirm(
        `${betroffen.length} Beleg(e) aus ${year} mit der Kategorie "${name}" werden auf "${STANDARD_KATEGORIE}" umgestellt. Fortfahren?`,
      )
    ) {
      return
    }
    setKategorienError(null)
    try {
      await Promise.all(betroffen.map((b) => saveWerbungskostenBeleg(user.uid, { ...b, kategorie: STANDARD_KATEGORIE })))
    } catch (err) {
      setKategorienError(err instanceof Error ? err.message : String(err))
      return
    }
    await persistKategorien(kategorien.filter((k) => k !== name))
  }

  /** Foto aufnehmen/wählen, auslesen und die erkannten Werte ins Formular übernehmen (Issue #79). */
  const handleScanFile = async (file: File) => {
    setScanHint(null)
    const result = await scan.scanFile(file, kategorien)
    if (!result) return
    setForm((f) => ({
      ...f,
      reDatum: result.datum ?? f.reDatum,
      artikel: result.beschreibung ?? f.artikel,
      shop: result.aussteller ?? f.shop,
      rechnungsnummer: result.rechnungsnummer ?? f.rechnungsnummer,
      betrag: result.bruttoBetrag !== null ? String(result.bruttoBetrag) : f.betrag,
      kategorie: result.kategorie ?? f.kategorie,
    }))
    const hints: string[] = []
    if (result.art === 'handwerker') hints.push('Der Beleg sieht eher nach einer Handwerkerleistung als nach Werbungskosten aus.')
    if (result.art === 'unklar') hints.push('Der Beleg konnte nicht sicher als Rechnung erkannt werden — bitte alle Werte prüfen.')
    setScanHint(hints.length > 0 ? hints.join(' ') : null)
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
    setForm({ ...EMPTY_FORM, kategorie: STANDARD_KATEGORIE, reDatum: `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01` })
    setEditingId(null)
    setFormOpen(true)
  }

  const startEdit = (b: WerbungskostenBeleg) => {
    setForm(belegToForm(b))
    setEditingId(b.id)
    setFormOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const betrag = Number(form.betrag)
    if (Number.isNaN(betrag) || betrag < 0) {
      setError('Bitte einen gültigen, nicht negativen Betrag eingeben.')
      return
    }
    const beleg: WerbungskostenBeleg = {
      id: editingId ?? crypto.randomUUID(),
      reDatum: form.reDatum,
      artikel: form.artikel.trim(),
      kategorie: form.kategorie.trim(),
      betrag,
    }
    if (form.shop.trim()) beleg.shop = form.shop.trim()
    if (form.rechnungsnummer.trim()) beleg.rechnungsnummer = form.rechnungsnummer.trim()
    if (form.belegRef.trim()) beleg.belegRef = form.belegRef.trim()

    setSaving(true)
    setError(null)
    try {
      if (scan.pending) {
        // Beleg erst jetzt, nach der Prüfung durch den Nutzer, nach OneDrive: <Jahr>/Werbungskosten/<Kategorie>/<Datum>_<Shop>_<Artikel>.jpg
        const belegJahr = /^\d{4}/.test(beleg.reDatum) ? beleg.reDatum.slice(0, 4) : String(year)
        const fileName = `${beleg.reDatum}_${safeName(beleg.shop ?? 'Beleg', 30)}_${safeName(beleg.artikel, 30)}.${scan.pending.extension}`
        try {
          const uploaded = await scan.upload(`${belegJahr}/Werbungskosten/${safeName(beleg.kategorie, 40)}`, fileName)
          if (uploaded) beleg.belegRef = uploaded.webUrl
        } catch (err) {
          setError(
            `Upload nach OneDrive fehlgeschlagen: ${err instanceof Error ? err.message : String(err)} — nichts wurde gespeichert. Erneut „Speichern“ versucht den Upload nochmal; ohne Beleg („Beleg entfernen“) wird nur der Eintrag gespeichert.`,
          )
          return
        }
      }
      await saveWerbungskostenBeleg(user.uid, beleg)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (b: WerbungskostenBeleg) => {
    if (!window.confirm(`Beleg "${b.artikel}" wirklich löschen?`)) return
    setError(null)
    try {
      await deleteWerbungskostenBeleg(user.uid, b.id)
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
        <h2>Werbungskosten {year}</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => setYear((y) => y + 1)}>
          Folgejahr →
        </button>
      </div>

      <div className="card-grid">
        <div className="card stat-tile">
          <span className="stat-label">Werbungskosten gesamt</span>
          <span className="stat-value">{formatEuro(gesamt)}</span>
          <span className="stat-sub">{belege.length} Beleg(e)</span>
        </div>
        {jeKategorie.map((k) => (
          <div key={k.kategorie} className="card stat-tile">
            <span className="stat-label">{k.kategorie}</span>
            <span className="stat-value">{formatEuro(k.betrag)}</span>
          </div>
        ))}
      </div>

      <div className="card form-card--wide" style={{ marginBottom: 'var(--space-5)' }}>
        <details className="info-details">
          <summary>
            <h3>Hinweise zu Pauschalen</h3>
            <svg className="info-details-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="5" r="2.2" fill="currentColor" />
              <rect x="10" y="9.5" width="4" height="11" rx="1" fill="currentColor" />
            </svg>
          </summary>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Für die folgenden Posten gibt es Pauschalen oder feste Sätze in der Steuererklärung. Du musst sie deshalb{' '}
          <strong>nicht als Beleg erfassen</strong> — trag hier nur Aufwendungen ein, die du einzeln nachweist.
        </p>
        <p className="form-hint" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-1)' }}>
          <strong>Zu den Pauschalen gehören:</strong>
        </p>
        <ul className="form-hint" style={{ marginTop: 0, paddingLeft: 'var(--space-4)' }}>
          <li>
            <strong>Arbeitnehmer-Pauschbetrag:</strong> 1.230 € werden automatisch berücksichtigt. Belegte
            Werbungskosten (inkl. Arbeitsweg) wirken sich erst aus, wenn die Summe diesen Betrag übersteigt.
            <div className="stat-sub"><span className="elster-label">In ELSTER:</span> Das Finanzamt berücksichtigt den Arbeitnehmer-Pauschbetrag automatisch.</div>
          </li>
          <li>
            <strong>Arbeitsweg:</strong> 0,30 € je Entfernungskilometer, ab dem 21. km 0,38 € (siehe Kachel „Arbeitsweg“
            in der Monats- und Jahresübersicht).
            <div className="stat-sub">
              <span className="elster-label">In ELSTER:</span> Anlage N, „Entfernungspauschale“. Angabe der einfachen
              Entfernung zur ersten Tätigkeitsstätte in km und Anzahl der Arbeitstage eintragen. Die Berechnung in ELSTER
              erfolgt automatisch.
            </div>
          </li>
          <li>
            <strong>Homeoffice-Pauschale:</strong> 6 € je Tag, höchstens 1.260 € pro Jahr (210 Tage).
            <div className="stat-sub">
              <span className="elster-label">In ELSTER:</span> Anlage N, Abschnitt zur Tätigkeit in der häuslichen Wohnung. Angabe der Anzahl der
              Homeoffice-Tage eintragen. Die Berechnung in ELSTER erfolgt automatisch.
            </div>
          </li>
          <li>
            <strong>Kontoführung:</strong> pauschal 16 € pro Jahr ohne Einzelnachweis üblich.
            <div className="stat-sub"><span className="elster-label">In ELSTER:</span> Anlage N, „Weitere Werbungskosten“. Angabe der Art „Kontoführungsgebühren“ und des
              Betrags von 16 € eintragen.
            </div>
          </li>
          <li>
            <strong>Telefon &amp; Internet:</strong> pauschal 20 % der Kosten, höchstens 20 € pro Monat.
            <div className="stat-sub">
              <span className="elster-label">In ELSTER:</span> Anlage N, „Weitere Werbungskosten“. Angabe der Art „Telefon/Internet“ und des
              Jahresbetrags (20 % deiner tatsächlichen Kosten, höchstens 240 €) eintragen.
            </div>
          </li>
          <li>
            <strong>Bewerbungskosten:</strong> pauschal ca. 10 € je Bewerbung (Papier) bzw. ca. 5 € (elektronisch).
            <div className="stat-sub">
              <span className="elster-label">In ELSTER:</span> Anlage N, „Weitere Werbungskosten“. Angabe der Art „Bewerbungskosten“ und der Summe
              (Anzahl der Bewerbungen mal Pauschale) eintragen.
            </div>
          </li>
          <li>
            <strong>Reisekosten (Verpflegung):</strong> 14 € ab 8 Std. Abwesenheit, 28 € bei 24 Std. (Inland).
            <div className="stat-sub">
              <span className="elster-label">In ELSTER:</span> Anlage N, „Reisekosten bei Auswärtstätigkeit“. Angabe der Tage und der
              Abwesenheitszeiten eintragen, nur für Kosten, die der Arbeitgeber nicht erstattet hat. Die Berechnung in
              ELSTER erfolgt automatisch.
            </div>
          </li>
          <li>
            <strong>Arbeitsmittel über 800 € netto</strong> werden nicht sofort, sondern über die Nutzungsdauer
            abgeschrieben (Computer/Peripherie: ein Jahr).
            <div className="stat-sub">
              <span className="elster-label">In ELSTER:</span> Anlage N, „Arbeitsmittel“. Angabe der Art und des Betrags je Posten eintragen, bei
              Abschreibung den Jahresanteil.
            </div>
          </li>
        </ul>
        <p
          className="form-hint"
          style={{ marginTop: 'var(--space-4)', marginBottom: 0, fontSize: 'var(--font-size-xs)', fontStyle: 'italic' }}
        >
          Richtwerte, keine Steuerberatung — bitte vor der Steuererklärung gegen die aktuellen offiziellen Werte prüfen. Bezeichnungen und Zeilen in ELSTER können sich von Jahr zu Jahr ändern.
        </p>
        </details>
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
            <h3 style={{ margin: 0 }}>Werbungskosten Belege ({belege.length})</h3>
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
            <BelegScanBox scan={scan} onFile={(file) => void handleScanFile(file)} hint={scanHint} />
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
              <span>Artikel</span>
              <input
                className="input"
                value={form.artikel}
                onChange={(e) => setForm({ ...form, artikel: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Kategorie</span>
              <select
                className="input"
                value={form.kategorie}
                onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
                required
              >
                {formKategorien.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Betrag (€)</span>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={form.betrag}
                onChange={(e) => setForm({ ...form, betrag: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Shop/Anbieter</span>
              <input className="input" value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} />
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
              <span>Beleg-Verweis (optional)</span>
              <input
                className="input"
                value={form.belegRef}
                onChange={(e) => setForm({ ...form, belegRef: e.target.value })}
                placeholder="https://…"
              />
            </label>
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
                <th>Artikel</th>
                <th>Kategorie</th>
                <th>Shop/Anbieter</th>
                <th style={{ textAlign: 'right' }}>Betrag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {belege.map((b) => (
                <tr key={b.id}>
                  <td>{formatDatum(b.reDatum)}</td>
                  <td>
                    {b.artikel}
                    {b.rechnungsnummer && <div className="stat-sub">Nr. {b.rechnungsnummer}</div>}
                    {b.belegRef && (
                      <div className="stat-sub">
                        <a href={b.belegRef} target="_blank" rel="noreferrer noopener">
                          Beleg öffnen
                        </a>
                      </div>
                    )}
                  </td>
                  <td>{b.kategorie}</td>
                  <td>{b.shop}</td>
                  <td style={{ textAlign: 'right' }}>{formatEuro(b.betrag)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(b)}>
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && belege.length === 0 && (
                <tr>
                  <td colSpan={6} className="form-hint">
                    Für {year} sind noch keine Belege erfasst.
                  </td>
                </tr>
              )}
            </tbody>
            {belege.length > 0 && (
              <tfoot>
                <tr>
                  <th colSpan={4}>Summe</th>
                  <th style={{ textAlign: 'right' }}>{formatEuro(gesamt)}</th>
                  <th />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}
      </div>

      <div className="card form-card--wide" style={{ marginBottom: 'var(--space-5)' }}>
        <details className="info-details">
          <summary>
            <h3>Kategorien {year}</h3>
          </summary>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Gelten für {year} und werden in Folgejahren übernommen, bis du dort andere festlegst. „{STANDARD_KATEGORIE}“ ist
          die Standardkategorie und kann nicht gelöscht werden. Wird eine andere Kategorie gelöscht, wandern ihre Belege
          aus {year} nach „{STANDARD_KATEGORIE}“.
        </p>
        {kategorienError && <p className="form-error">{kategorienError}</p>}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-3)' }}>
          {kategorien.map((k) => (
            <li
              key={k}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-1) 0' }}
            >
              <span>{k}</span>
              {k !== STANDARD_KATEGORIE && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => void handleDeleteKategorie(k)}
                  aria-label={`Kategorie ${k} löschen`}
                >
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddKategorie} className="inline-form">
          <input
            className="input"
            placeholder="Neue Kategorie (z. B. Fachliteratur)"
            style={{ flex: '1 1 240px' }}
            value={newKategorie}
            onChange={(e) => setNewKategorie(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Hinzufügen
          </button>
        </form>
        </details>
      </div>

      <div className="card form-card--wide">
        <details className="info-details">
          <summary>
            <h3>Monatsübersicht</h3>
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
