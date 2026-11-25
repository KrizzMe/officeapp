# Projektbeschreibung: Anwesenheits- & Urlaubs-Tracker (Kalender-App)

## 1. Kontext & Ziel

Web-App für mehrere Nutzer, um für die Steuererklärung Handwerkerabrechnungen, Werbungskosten und Arbeitswegestrecken zu sammeln, sowie um die vom Arbeitgeber geforderte Anwesenheitsquote (Büro vs. Homeoffice) zu berechnen.

**MVP-Scope:** Kalenderfunktion + Anwesenheits-/Urlaubstracking, jeweils pro Nutzer.
**Ursprünglich außerhalb des MVP, inzwischen umgesetzt:** Steuerteil (Handwerkerabrechnungen, Werbungskosten-Belege inkl. Beleg-Scan, Issues #10/#79/#81) und Arbeitszeiterfassung mit Überstunden-Saldo (Issue #83), siehe Abschnitte 5.6 und 7.

Die App setzt auf ein sauberes, eigenes Datenmodell.

## 2. Tech-Stack

- **Firebase Auth** – Login ausschließlich über Google Sign-In
- **Firestore** – Datenhaltung
- **Firebase Hosting** – Deployment
- Frontend: responsive Web-App (Desktop + Mobile aus einem Code-Stand, kein separates natives App-Projekt), React + TypeScript + Vite
- Beleg-Auslesung (Issue #79): eigene Serverfunktion auf Vercel (`vercel-api/`, Mistral Vision), KI-Key nur im Backend
- Beleg-Ablage (Issue #79/#81): OneDrive über Microsoft Graph + MSAL.js
- Adressprüfung/Arbeitsweg (Issue #61): OpenStreetMap Nominatim + OSRM
- Keine eigene Verschlüsselung für den Steuerdaten-Bereich (Issue #11, entschieden — siehe Abschnitt 7)

## 3. Nutzer & Multi-User

- Multi-User von Anfang an, nicht nachträglich ergänzt
- Jeder Nutzer hat einen eigenen, isolierten Datensatz (Kalender, Profil, Urlaubskonto) — **keine** gemeinsame Tabellensicht
- Zielgruppe: zwei Nutzer (Ehepaar), die App muss aber nicht auf genau zwei Accounts hart codiert sein
- Optional/später: eine gemeinsame Ansicht (z. B. für Urlaubsplanung) — für MVP nicht erforderlich

## 4. Datenmodell

### 4.1 User-Profil

- Wohnadresse (einmalige Eingabe; Straße, PLZ, Ort getrennt, Issue #61)
- Arbeitsadresse (einmalige Eingabe; Straße, PLZ, Ort getrennt, Issue #61)
- Standard-Arbeitsweg in km; die Adressprüfung (Issue #61) geocodiert beide Adressen und berechnet die kürzeste Straßenverbindung als Referenzwert — der Standard-Arbeitsweg bleibt frei abweichend pflegbar
- Regelurlaub und Resturlaub aus dem Vorjahr — beide als Urlaubsarten modelliert (siehe 4.3)
- Frei definierbare **Urlaubsarten** (siehe 4.3) — pro Nutzer individuell, da sich die Arten zwischen den beiden Nutzern unterscheiden (z. B. Dispositionstage nur bei einem, Sonderurlaub nur bei der anderen Person)
- Bundesland (für automatische Feiertagszuordnung — nicht hart codiert)
- Arbeitstage (Mo-So einzeln wählbar, Issue #34) — Default Mo-Fr; bestimmt, welche Wochentage arbeitsfrei sind statt fest Sa/So anzunehmen, z. B. für Teilzeitkräfte mit Arbeitstagen Do-So
- Home Office erlaubt (an/aus) — manche Tätigkeiten erlauben grundsätzlich kein Homeoffice; ist der Schalter aus, ist der Tagesstatus `Homeoffice` im Kalender nicht wählbar
- Home-Office-Quote (max. % der möglichen Arbeitstage) — Vorgabe, die im Dashboard der tatsächlichen Homeoffice-Quote gegenübergestellt wird
- Regelmäßige Homeoffice-Wochentage (Teilmenge der Arbeitstage einzeln wählbar, Issue #39, nur relevant wenn Home Office erlaubt) — dient als Vorbelegung für zukünftige Monate ohne eigenen Eintrag (siehe 5.2); wirkt nie auf den aktuellen oder vergangene Monate. Arbeitsfreie Tage sind nicht auswählbar, da an ihnen kein Homeoffice vorbelegt werden kann.
- Zusätzliche AG-freie Tage (Issue #37, z. B. 24.12./31.12. durch Betriebsvereinbarung) — frei definierbare Liste aus Datum (Tag+Monat, wiederkehrend jedes Jahr) und Bezeichnung, zentral im Profil gepflegt statt pro Jahr neu einzutragen. Werden wie gesetzliche Feiertage behandelt (siehe 4.2, 5.2).
- Wochenarbeitszeit in Stunden (Issue #83) — Grundlage für das Soll je Arbeitstag (siehe 5.6); ohne Angabe ist kein Überstunden-Saldo berechenbar
- Überstunden-Übertrag je Jahr (Issue #83), optional manuell überschreibbar (siehe 5.6)
- Werbungskosten-Kategorien je Jahr (Issue #10)
- Beleg-Ablage in OneDrive (Issue #79/#81): Stamm-Pfad und Ordnernamen für Handwerker- und Werbungskosten-Belege; OneDrive-Verbindung (Status, Verbinden, Trennen) im Profil
- Farbdesign (Lila / Rot-Weiß / Gelb-Grün, Issue #21) und Hell-/Dunkelmodus (Issue #41, inkl. „automatisch“)

### 4.2 Tagesstatus (ein Eintrag pro Tag im Kalender)

Statt zwei getrennter Felder (Homeoffice-Flag + Abwesenheits-Dropdown) **ein einziger Status pro Tag**:

- `Büro` (Standard-Fallback für jeden Arbeitstag ohne andere Markierung — siehe 5.2)
- `Homeoffice`
- `Dienstreise`
- `Krank`
- `Kind krank`
- plus die vom Nutzer im Profil definierten Urlaubsarten (z. B. `Urlaub`, `Resturlaub`, `Dispositionstag`, `Sonderurlaub`, `Umwandlungstag`, `Gleitzeit`, `Regeneration`, …)

`Krank` und `Kind krank` haben kein Jahres-Kontingent wie die Urlaubsarten, da Krankheitstage nicht begrenzt sind (Issue #23). Für `Dienstreise`, `Krank` und `Kind krank` kann pro Zeitraum ein optionaler Grund hinterlegt werden (Issue #33, in der Jahresübersicht editierbar).

Arbeitsfreie Tage (laut den im Profil gewählten Arbeitstagen), Feiertage und AG-freie Tage (Issue #37) werden automatisch erkannt, nicht manuell gesetzt.

Für Tage mit Status `Büro` wird die Wegstrecke (km) automatisch aus der hinterlegten Standardstrecke übernommen (siehe 5.3). Das Datenmodell kennt zwar eine Tagesstrecke (`DayEntry.distanceKm`), in der Oberfläche ist eine Überschreibung pro Tag aber nicht vorgesehen.

An Tagen mit Status `Büro` oder `Homeoffice` kann zusätzlich die Arbeitszeit erfasst werden (Issue #83, siehe 5.6).

### 4.3 Urlaubsarten (konfigurierbar pro Nutzer)

Jede Urlaubsart hat:

- Name (frei wählbar, z. B. "Dispositionstag")
- Gesamtkontingent (Anzahl Tage/Jahr)
- Optional: Rhythmus/Regel (z. B. "1 pro Quartal" bei Dispositionstagen)

Urlaubsarten werden **je Jahr** gepflegt (Issue #72); ein Jahr ohne eigene Liste übernimmt die Arten des Vorjahres. Der Resturlaub wird automatisch aus den ungenutzten Urlaubstagen des Vorjahres berechnet, kann aber manuell überschrieben werden (Issue #74).

## 5. Berechnungslogik

### 5.1 Anwesenheitsquote

```
Mögliche Arbeitstage = Tage mit Status Büro + Homeoffice + Dienstreise
                        (Urlaub/Krank/Feiertage/AG-freie Tage/Wochenende zählen nicht mit)

Anwesenheitsquote = (Büro-Tage + Dienstreise-Tage) / Mögliche Arbeitstage
```

- Die geforderte Mindestquote ist kein fester Wert, sondern ergibt sich pro Nutzer aus `100 % - Home-Office-Quote` (Profil-Feld, siehe 4.1) — je nach Arbeitgeber-Vorgabe unterschiedlich. Ohne explizite Angabe gilt die ursprüngliche 40/60-Regel (≥ 40 % Anwesenheit, max. 60 % Homeoffice) als Default. Ist Homeoffice im Profil nicht erlaubt, sind 100 % Anwesenheit gefordert.
- **Live und direkt sichtbar** in der App (nicht nur als separate Auswertung) — z. B. laufender Prozentwert/Fortschrittsanzeige für den aktuellen Zeitraum

### 5.2 Standard-Fallback-Logik für Bürotage

Jeder Arbeitstag (laut Profil, Default Mo–Fr; kein Feiertag, kein AG-freier Tag) ohne anderen gesetzten Status gilt automatisch als `Büro` mit der Standard-Wegstrecke. Der Nutzer markiert nur die Ausnahmen (Homeoffice, Urlaub, Dienstreise, Krank, …). Das minimiert die Klicks im Alltag.

Ausnahme (Issue #39): Fällt ein Werktag ohne eigenen Eintrag in einen **strikt zukünftigen** Monat (nicht der aktuelle Monat, auch nicht ein vergangener) und auf einen im Profil gewählten Homeoffice-Wochentag, gilt er stattdessen als `Homeoffice`. Das ist reine Berechnungslogik ohne eigene Firestore-Einträge — Änderungen an den Homeoffice-Wochentagen wirken sich dadurch automatisch nie auf den aktuellen oder vergangene Monate aus. Einzelne Tage bleiben weiterhin manuell überschreibbar.

### 5.3 Arbeitsweg / Pendlerpauschale

- Summe aller km an Tagen mit Status `Büro` (Standardstrecke aus dem Profil) über das Jahr (für die Steuererklärung nutzbar); Dienstreisen zählen nicht mit, gezählt wird nur bis heute
- Anzeige als Kachel „Arbeitsweg“ im Kalender (Monat) und in der Jahresübersicht sowie als km-Spalte in der Monatstabelle
- Eine Überschreibung pro Tag ist nicht vorgesehen (die Pendlerpauschale wird pauschal angesetzt)

### 5.4 Urlaubskontingente

- **Gesamtkontingent** (alle Urlaubsarten zusammen) UND **pro einzelner Urlaubsart** wird getrennt getrackt (sauber pro Urlaubsart modelliert)
- Anzeige verbleibender Tage pro Urlaubsart und gesamt

### 5.5 Dispositionstage-Regel (Beispiel für Urlaubsarten mit Rhythmus)

- Aktive Durchsetzung/Anzeige: "Dieses Quartal bereits verbraucht"
- Warnung, falls ein zweiter Dispositionstag im selben Quartal eingetragen werden soll

### 5.6 Arbeitszeit und Überstunden-Saldo (Issue #83)

- Erfassung an `Büro`- und `Homeoffice`-Tagen: mehrere Arbeitsblöcke pro Tag (z. B. 08:00–14:00 und 16:00–18:00; Lücken zählen nicht als Arbeitszeit) **oder** nur die Anwesenheit in Stunden ohne Uhrzeiten (zum Nachtragen), optional mit selbst eingetragener Pause
- Stempeln (Kommen/Gehen) auf dem Dashboard; ein Block ohne Ende läuft noch, mit Feierabend-Prognose
- Gesetzliche Mindestpause (§ 4 ArbZG) wird abgezogen: mehr als 6 h Anwesenheit → mind. 30 Min., mehr als 9 h → mind. 45 Min.
- Soll je Arbeitstag = Wochenstunden / Anzahl Arbeitstage
- Tagesbewertung fürs Saldo:
  - `Dienstreise`, Urlaubsarten, `Krank`, Feiertage, AG-freie Tage: pauschal mit dem Soll gutgeschrieben (Saldo 0)
  - `Büro`/`Homeoffice` mit Zeiten: Netto-Arbeitszeit − Soll
  - vergangener `Büro`-/`Homeoffice`-Tag ohne Zeiten: 0 h Ist (Saldo −Soll); per „Fehlende Tage mit Soll füllen“ in der Monatsübersicht nachtragbar
  - zukünftige Tage zählen nie, der heutige Tag nur, wenn bereits Zeiten erfasst sind
- Übertrag ins Folgejahr: automatisch Übertrag + Jahressaldo des Vorjahres (ab dem ersten Jahr mit erfassten Zeiten), je Jahr manuell überschreibbar
- Die Netto-Arbeitszeit wird nicht gespeichert, sondern berechnet (`src/lib/arbeitszeit.ts`)

## 6. UI-Anforderungen

- **Dashboard** (Startseite, Issue #53): Anwesenheitsquote, heutiger Status (direkt änderbar), Stempeln und Überstunden-Saldo
- **Monatsübersicht:** Kalenderansicht (Monat) als zentrale Eingabe: Tag anklicken → Status wählen (bzw. Arbeitszeit erfassen); Kacheln für Quote, Urlaub je Art, Arbeitsweg und Überstunden
- **Jahresübersicht:** Monatstabelle (Quote, km, Saldo), Urlaubs-/Krankheits-/Dienstreise-Zeiträume, Überstunden-Übertrag
- **Handwerkerleistungen** und **Werbungskosten** als eigene Bereiche (Steuerteil, siehe 8)
- Anwesenheitsquote (gegen die individuelle Home-Office-Quote) permanent sichtbar (z. B. im Kalender-Header oder als Dashboard-Kachel)
- Übersicht verbleibender Urlaubstage (gesamt + pro Art)
- Responsive: vollwertig nutzbar auf Smartphone und Desktop

## 7. Roadmap (nicht Teil des MVP-Auftrags)

- Steuerteil (Issue #10, umgesetzt): Handwerkerleistungen und Werbungskosten je Nutzer in den Firestore-Collections `handwerker` und `werbungskosten` (Rechnungsdatum, Beträge, Kategorie, optionaler Beleg-Verweis). Berechnung: Netto = Brutto / 1,19, Arbeitskosten = Netto − Material, Arbeitskosten inkl. MwSt = × 1,19; Richtwert Steuerermäßigung 20 % (max. 1.200 €/Jahr). Monats-/Jahresübersicht, kein Export.
- Steuerdaten-Schutz (Issue #11, entschieden): keine eigene Verschlüsselung; strikte Firestore-Rules, nur Beträge + Verweis in der App (Originale im privaten Cloud-Speicher), minimale Cloud-Rechte, KI/OCR-Keys nur im Backend.
- Beleg-Scan (Issue #79, umgesetzt): Foto(s) oder PDF eines Belegs → Auslesen von Datum, Firma/Shop, Leistung/Artikel, Rechnungsnummer, Beträgen und Kategorie per KI (Vercel-Funktion `vercel-api/`, Mistral). Digitale PDFs werden über ihre Textebene gelesen, gescannte PDFs und Fotos als Bilder (bis zu 8 pro Beleg). Mehrere Fotos werden zu einem PDF zusammengefasst und in OneDrive unter `<Stamm-Pfad>/<Jahr>/<Ordnername>` abgelegt (Dateiname `JJJJ.MM.TT_Artikel` bzw. `JJJJ.MM.TT_Firma-Leistung`); der Link wird als Beleg-Verweis gespeichert. Ohne konfigurierte Umgebungsvariablen bleibt die Funktion ausgeblendet.
- OneDrive-Verbindung im Profil verwalten (Issue #81, umgesetzt): Status, Verbinden, Trennen. Ohne eigenen Stamm-Pfad nur App-Ordner-Rechte (`Files.ReadWrite.AppFolder`).
- Arbeitszeiterfassung mit Überstunden-Saldo (Issue #83, umgesetzt), siehe 5.6
- Offen: gemeinsame Kalenderansicht für Urlaubsplanung zu zweit (Issue #12)
- Offen (technisch): Code-Splitting (#9), Testabdeckung mit Vitest (#66), Refactorings (#67–#69), Navigation über URL-Routen (#70)
