# Office App

Anwesenheits-, Urlaubs- und Arbeitszeit-Tracker mit Steuerteil (Web-App). Löst eine jährlich neu aufgesetzte Excel-Datei ab, die zur Berechnung der Homeoffice-/Büro-Anwesenheitsquote, zum Tracking von Urlaubskontingenten, zur Erfassung der Pendlerstrecke und zum Sammeln von Handwerkerleistungen und Werbungskosten für die Steuererklärung diente.

Vollständige Projektbeschreibung: [`docs/projektbeschreibung-anwesenheits-app.md`](docs/projektbeschreibung-anwesenheits-app.md).

## Status

Produktiv im Einsatz (Firebase Hosting, Deploy automatisch bei Merge auf `main`). Umgesetzt:

- **Dashboard:** Anwesenheitsquote, heutiger Status (direkt änderbar), Stempeln (Kommen/Gehen) und Überstunden-Saldo
- **Monatsübersicht:** Kalender als zentrale Eingabe (ein Status pro Tag), Kacheln für Quote, Urlaub je Art, Arbeitsweg (km) und Überstunden; fehlende Tage lassen sich mit dem Soll füllen
- **Jahresübersicht:** Monatstabelle (Quote, km, Saldo), Urlaubs-, Krankheits- und Dienstreise-Zeiträume, Überstunden-Übertrag
- **Arbeitszeiterfassung** (#83): mehrere Arbeitsblöcke pro Tag oder nur Stunden, gesetzliche Mindestpause (§ 4 ArbZG), Saldo gegen die Wochenstunden mit Übertrag ins Folgejahr
- **Urlaub:** frei definierbare Urlaubsarten je Jahr (#72) mit Kontingent und Rhythmus (z. B. Dispositionstag 1×/Quartal), automatischer Resturlaub-Übertrag (#74)
- **Profil:** Adressen mit Adressprüfung und kürzestem Arbeitsweg (#61), Bundesland (Feiertage), Arbeitstage Mo–So, Homeoffice-Schalter/-Quote/-Wochentage, AG-freie Tage, Wochenstunden, Farbdesign + Hell/Dunkel, Beleg-Ablage und OneDrive-Verbindung
- **Steuerteil** (#10): Handwerkerleistungen und Werbungskosten je Jahr, Beleg-Scan per KI (Foto/PDF → Rechnungsdaten, #79) mit Ablage in OneDrive (#81)

Offene Themen (Auswahl): gemeinsame Kalenderansicht (#12), Code-Splitting (#9), Tests mit Vitest (#66), Refactorings (#67–#69), URL-Routing (#70).

## Tech-Stack

- **Frontend:** React 19 + TypeScript + Vite (responsive, eine Codebasis für Desktop und Mobil)
- **Auth:** Firebase Auth (Google Sign-In)
- **Datenhaltung:** Firestore (`users/{uid}` mit Unter-Collections `days`, `handwerker`, `werbungskosten`; Regeln in `firestore.rules`)
- **Hosting:** Firebase Hosting (Projekt `officeapp-krizzme`, Target `prod`)
- **Beleg-Auslesung:** Serverfunktion in [`vercel-api/`](vercel-api/README.md) (eigenes Vercel-Projekt, Mistral Vision); PDFs per `pdfjs-dist`
- **Beleg-Ablage:** OneDrive über Microsoft Graph + MSAL.js (`@azure/msal-browser`)
- **Adressprüfung/Arbeitsweg:** OpenStreetMap Nominatim (Geocoding) und OSRM (Routing)

## Setup

```bash
npm install
cp .env.example .env.local   # Firebase-Zugangsdaten eintragen
npm run dev                  # http://localhost:5173
```

Weitere Befehle: `npm run build` (tsc + vite), `npm run lint`, `npm run preview`, `npm run deploy` (Build + `firebase deploy`).

### Umgebungsvariablen

| Variable | Pflicht | Zweck |
|---|---|---|
| `VITE_FIREBASE_*` | ja | Web-App-Zugangsdaten aus den Firebase-Projekteinstellungen |
| `VITE_BELEG_API_URL` | nein | URL der Vercel-Funktion; ohne Wert bleibt der Beleg-Scan ausgeblendet |
| `VITE_MS_CLIENT_ID` | nein | Client-ID der Microsoft-Entra-App für die OneDrive-Ablage |

Für den PROD-Build liegen dieselben Werte als GitHub-Secrets vor (siehe `.github/workflows/firebase-hosting-merge.yml`).

## Deployment

- **Pull Request:** `firebase-hosting-pull-request.yml` prüft nur, dass der Build durchläuft (kein Test-Deploy; getestet wird lokal).
- **Merge auf `main`:** `firebase-hosting-merge.yml` baut und deployt das **Hosting** auf PROD.
- **Firestore-Regeln/-Indexe** werden von der CI nicht deployt — nach Änderungen an `firestore.rules` bzw. `firestore.indexes.json` manuell: `firebase deploy --only firestore`.
- **Vercel-Funktion:** separates Vercel-Projekt (Root Directory `vercel-api`), siehe [`vercel-api/README.md`](vercel-api/README.md).

## Firebase-Projekt neu verbinden

1. Firebase-Projekt in der [Firebase Console](https://console.firebase.google.com/) anlegen
2. Google Sign-In unter Authentication aktivieren
3. Firestore-Datenbank anlegen
4. Web-App-Zugangsdaten aus den Projekteinstellungen in `.env.local` eintragen
5. `firebase deploy` deployt Hosting, Firestore-Regeln (`firestore.rules`) und Indexe (`firestore.indexes.json`)

## Projektstruktur

```
src/
  components/   UI (Seiten, Kacheln, Kalender, Dialoge)
  hooks/        Daten-Hooks (Auth, Profil, Jahreseinträge, Belege, Arbeitszeitkonto)
  lib/          Berechnungslogik (Anwesenheit, Urlaub, Arbeitszeit, Pendler-km, Feiertage, Steuern, OneDrive, PDF)
  firebase/     Firebase-Init und Firestore-Zugriffe
  types/        Datenmodell (models.ts)
vercel-api/     Serverfunktion Beleg-Auslesung
docs/           Projektbeschreibung
```

## Datenmodell

Siehe [`src/types/models.ts`](src/types/models.ts) — orientiert an Abschnitt 4 der Projektbeschreibung, jedoch bewusst nicht 1:1 aus der Referenz-Excel übernommen.

## Referenz

`docs/Steuern_2026.xlsx` — bisherige Excel-Lösung mit allen Formeln für Anwesenheitsquote, Urlaubszählung und Wegstrecken-Zuordnung. Enthält reale Privatadressen, daher `.gitignore`d — nur lokale Referenz, nicht im Repo.
