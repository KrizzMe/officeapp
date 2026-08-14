# Projektbeschreibung: Anwesenheits- & Urlaubs-Tracker (Kalender-App)

## 1. Kontext & Ziel

Ablösung einer bestehenden, komplexen Excel-Datei, die pro Jahr neu aufgesetzt werden musste. Die Excel wurde bisher von zwei Personen (Ehepaar) gemeinsam genutzt, um für die Steuererklärung Handwerkerabrechnungen, Werbungskosten und Arbeitswegestrecken zu sammeln, sowie um die vom Arbeitgeber geforderte Anwesenheitsquote (Büro vs. Homeoffice) zu berechnen.

**MVP-Scope:** Kalenderfunktion + Anwesenheits-/Urlaubstracking, jeweils pro Nutzer.
**Explizit außerhalb des MVP (spätere Erweiterung/Add-on):** Steuerteil (Handwerkerabrechnungen, Werbungskosten-Belege).

Die App muss die Excel **nicht strukturell nachbilden** — Berechnungslogik übernehmen, aber ein sauberes, eigenes Datenmodell entwerfen.

## 2. Tech-Stack

- **Firebase Auth** – Login ausschließlich über Google Sign-In
- **Firestore** – Datenhaltung
- **Firebase Hosting** – Deployment
- Frontend: responsive Web-App (Desktop + Mobile aus einem Code-Stand, kein separates natives App-Projekt)
- Später (nicht MVP): besondere Verschlüsselung für Steuerdaten-Bereich

## 3. Nutzer & Multi-User

- Multi-User von Anfang an, nicht nachträglich ergänzt
- Jeder Nutzer hat einen eigenen, isolierten Datensatz (Kalender, Profil, Urlaubskonto) — **keine** gemeinsame Tabellensicht wie bisher in der Excel
- Zielgruppe: zwei Nutzer (Ehepaar), die App muss aber nicht auf genau zwei Accounts hart codiert sein
- Optional/später: eine gemeinsame Ansicht (z. B. für Urlaubsplanung) — für MVP nicht erforderlich

## 4. Datenmodell

### 4.1 User-Profil

- Wohnadresse (einmalige Eingabe)
- Arbeitsadresse (einmalige Eingabe)
- Regelurlaub (Anzahl Tage/Jahr)
- Resturlaub aus Vorjahr (Anzahl Tage)
- Frei definierbare **Urlaubsarten** (siehe 4.3) — pro Nutzer individuell, da sich die Arten zwischen den beiden Nutzern unterscheiden (z. B. Dispositionstage nur bei einem, Sonderurlaub nur bei der anderen Person)
- Bundesland (für automatische Feiertagszuordnung — die bisherige Excel nutzt bayerische Feiertage, das sollte aber nicht hart codiert sein)
- Arbeitstage (Mo-So einzeln wählbar, Issue #34) — Default Mo-Fr; bestimmt, welche Wochentage arbeitsfrei sind statt fest Sa/So anzunehmen, z. B. für Teilzeitkräfte mit Arbeitstagen Do-So
- Home Office erlaubt (an/aus) — manche Tätigkeiten erlauben grundsätzlich kein Homeoffice; ist der Schalter aus, ist der Tagesstatus `Homeoffice` im Kalender nicht wählbar
- Home-Office-Quote (max. % der möglichen Arbeitstage) — Vorgabe, die im Dashboard der tatsächlichen Homeoffice-Quote gegenübergestellt wird

### 4.2 Tagesstatus (ein Eintrag pro Tag im Kalender)

Statt der bisherigen zwei getrennten Excel-Felder (Homeoffice-Flag + Abwesenheits-Dropdown) **ein einziger Status pro Tag**:

- `Büro` (Standard-Fallback für jeden Arbeitstag ohne andere Markierung — siehe 5.2)
- `Homeoffice`
- `Dienstreise`
- `Krank`
- `Kind krank`
- plus die vom Nutzer im Profil definierten Urlaubsarten (z. B. `Urlaub`, `Resturlaub`, `Dispositionstag`, `Sonderurlaub`, `Umwandlungstag`, `Gleitzeit`, `Regeneration`, …) — kein Jahres-Kontingent wie bei den Urlaubsarten, da Krankheitstage nicht begrenzt sind (Issue #23)

Arbeitsfreie Tage (laut den im Profil gewählten Arbeitstagen) und Feiertage werden automatisch erkannt, nicht manuell gesetzt.

Für Tage mit Status `Büro` oder `Dienstreise`: Wegstrecke (km) wird automatisch aus der hinterlegten Standardstrecke übernommen, ist aber **pro Tag überschreibbar** (z. B. Ausweichroute, abweichendes Ziel bei Dienstreise).

### 4.3 Urlaubsarten (konfigurierbar pro Nutzer)

Jede Urlaubsart hat:

- Name (frei wählbar, z. B. "Dispositionstag")
- Gesamtkontingent (Anzahl Tage/Jahr)
- Optional: Rhythmus/Regel (z. B. "1 pro Quartal" bei Dispositionstagen)

## 5. Berechnungslogik (aus bestehender Excel übernommen)

### 5.1 Anwesenheitsquote

```
Mögliche Arbeitstage = Tage mit Status Büro + Homeoffice + Dienstreise
                        (Urlaub/Krank/Feiertage/Wochenende zählen nicht mit)

Anwesenheitsquote = (Büro-Tage + Dienstreise-Tage) / Mögliche Arbeitstage
```

- Die geforderte Mindestquote ist kein fester Wert, sondern ergibt sich pro Nutzer aus `100 % - Home-Office-Quote` (Profil-Feld, siehe 4.1) — je nach Arbeitgeber-Vorgabe unterschiedlich. Ohne explizite Angabe gilt die ursprüngliche 40/60-Regel (≥ 40 % Anwesenheit, max. 60 % Homeoffice) als Default. Ist Homeoffice im Profil nicht erlaubt, sind 100 % Anwesenheit gefordert.
- **Live und direkt sichtbar** in der App (nicht nur als separate Auswertung) — z. B. laufender Prozentwert/Fortschrittsanzeige für den aktuellen Zeitraum

### 5.2 Standard-Fallback-Logik für Bürotage

Jeder Werktag (Mo–Fr, kein Feiertag) ohne anderen gesetzten Status gilt automatisch als `Büro` mit der Standard-Wegstrecke. Der Nutzer markiert nur die Ausnahmen (Homeoffice, Urlaub, Dienstreise, Krank, …). Das minimiert die Klicks im Alltag und entspricht der bisherigen Excel-Logik.

### 5.3 Arbeitsweg / Pendlerpauschale

- Summe aller km an Tagen mit Status `Büro`/`Dienstreise` über das Jahr (für die Steuererklärung nutzbar)
- Route/km-Wert pro Tag überschreibbar (Beispiel aus der Praxis: kürzester Weg ist eine Strecke, tatsächlich gefahren wird aber regelmäßig eine andere, meist schnellere Route mit mehr km)

### 5.4 Urlaubskontingente

- **Gesamtkontingent** (alle Urlaubsarten zusammen) UND **pro einzelner Urlaubsart** wird getrennt getrackt (in der bisherigen Excel über mehrere SUMPRODUCT-Formeln gelöst — in der neuen App sauber pro Urlaubsart modellieren, nicht nachbauen)
- Anzeige verbleibender Tage pro Urlaubsart und gesamt

### 5.5 Dispositionstage-Regel (Beispiel für Urlaubsarten mit Rhythmus)

- Aktive Durchsetzung/Anzeige: "Dieses Quartal bereits verbraucht"
- Warnung, falls ein zweiter Dispositionstag im selben Quartal eingetragen werden soll

## 6. UI-Anforderungen

- Kalenderansicht (Monat) als zentrale Eingabe: Tag anklicken → Status wählen
- Anwesenheitsquote (gegen die individuelle Home-Office-Quote) permanent sichtbar (z. B. im Kalender-Header oder als Dashboard-Kachel)
- Übersicht verbleibender Urlaubstage (gesamt + pro Art)
- Responsive: vollwertig nutzbar auf Smartphone und Desktop

## 7. Referenz

Die bestehende Excel-Datei (inkl. aller Formeln für Anwesenheitsquote, Urlaubszählung und Wegstrecken-Zuordnung) liegt als Referenz vor und sollte für die exakte Berechnungslogik herangezogen werden.

## 8. Roadmap (nicht Teil des MVP-Auftrags)

- Steuerteil: Handwerkerabrechnungen, Werbungskosten (Beleg-Erfassung, Kategorien)
- Besondere Verschlüsselung für Steuerdaten
- Gemeinsame Kalenderansicht für Urlaubsplanung zu zweit
