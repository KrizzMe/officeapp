# Office App

Anwesenheits-, Urlaubs- und Arbeitszeit-Tracker mit Steuerteil (Web-App). Berechnet die Homeoffice-/Büro-Anwesenheitsquote, verfolgt Urlaubskontingente, erfasst die Pendlerstrecke und sammelt Handwerkerleistungen und Werbungskosten für die Steuererklärung.

Vollständige Projektbeschreibung: [`docs/projektbeschreibung-anwesenheits-app.md`](docs/projektbeschreibung-anwesenheits-app.md).

## Status

Produktiv im Einsatz (Firebase Hosting, Deploy automatisch bei Merge auf `main`). Umgesetzt:

- **Dashboard:** Anwesenheitsquote, heutiger Status (direkt änderbar), Stempeln (Kommen/Gehen) und Überstunden-Saldo
- **Monatsübersicht:** Kalender als zentrale Eingabe (ein Status pro Tag), Kacheln für Quote, Urlaub je Art, Arbeitsweg (km) und Überstunden; fehlende Tage lassen sich mit dem Soll füllen
- **Jahresübersicht:** Monatstabelle (Quote, km, Saldo), Urlaubs-, Krankheits- und Dienstreise-Zeiträume, Überstunden-Saldo
- **Arbeitszeiterfassung:** mehrere Arbeitsblöcke pro Tag oder nur Stunden, gesetzliche Mindestpause (§ 4 ArbZG), Saldo gegen die Wochenstunden mit Übertrag ins Folgejahr
- **Urlaub:** frei definierbare Urlaubsarten je Jahr mit Kontingent und Rhythmus (z. B. Dispositionstag 1×/Quartal), automatischer Resturlaub-Übertrag
- **Profil:** Adressen mit Adressprüfung und kürzestem Arbeitsweg, Bundesland (Feiertage), Arbeitstage Mo–So, Homeoffice-Schalter/-Quote/-Wochentage, AG-freie Tage, Wochenstunden, Farbdesign + Hell/Dunkel, Beleg-Ablage und OneDrive-Verbindung
- **Steuerteil:** Handwerkerleistungen und Werbungskosten je Jahr, Beleg-Scan per KI (Foto/PDF → Rechnungsdaten) mit Ablage in OneDrive

Offene Themen (Auswahl): gemeinsame Kalenderansicht, Code-Splitting, Tests mit Vitest, Refactorings, Navigation über URL-Routen.

## Tech-Stack

- **Frontend:** React 19 + TypeScript + Vite (responsive, eine Codebasis für Desktop und Mobil)
- **Auth:** Firebase Auth (Google Sign-In)
- **Datenhaltung:** Firestore (`users/{uid}` mit Unter-Collections `days`, `handwerker`, `werbungskosten`; Regeln in `firestore.rules`)
- **Hosting:** Firebase Hosting (Projekt `officeapp-krizzme`, Target `prod`)
- **Serverfunktion:** [`vercel-api/`](vercel-api/README.md) auf Vercel (KI-Beleg-Scan)
- **Bibliotheken:** `firebase`, `@azure/msal-browser` (OneDrive-Login), `pdfjs-dist` (PDF-Text und -Vorschau)
- Externe APIs (Adressprüfung, KI, OneDrive …): siehe [Externe Dienste & APIs](#externe-dienste--apis)

## Externe Dienste & APIs

Welche Dienste die App nutzt, wofür und welche Daten dorthin gehen. Zugangsdaten stehen nie im Repo, sondern in `.env.local`, GitHub-Secrets bzw. den Vercel-Umgebungsvariablen (nur die Variablennamen sind hier genannt).

| Bereich | Dienst | Aufruf von | Was übertragen wird | Konfiguration |
|---|---|---|---|---|
| Hosting der App | Firebase Hosting (Google) | CI bei Merge auf `main` | statischer Build (`dist/`) | GitHub-Secret Service-Account, Target `prod` |
| Login | Firebase Authentication, Google Sign-In (Popup) | Browser | Google-Konto-Anmeldung | `VITE_FIREBASE_*` |
| Datenhaltung | Cloud Firestore | Browser (Firebase SDK) | Profil, Tagesstatus, Arbeitszeiten, Belegdaten — je Nutzer isoliert per `firestore.rules` | `VITE_FIREBASE_*` |
| Adressprüfung (Geocoding) | OpenStreetMap **Nominatim** (öffentliche API, kostenlos) | Browser, nur per Klick auf „Prüfen“ | eingegebene Wohn-/Arbeitsadresse | keine; Nutzungsrichtlinie: max. 1 Anfrage/Sekunde, kein Bulk-Geocoding |
| Kürzester Arbeitsweg | **OSRM**-Demo-Server (`router.project-osrm.org`, kostenlos) | Browser | Koordinaten von Wohn- und Arbeitsort | keine; Auto-Routing, für geringes Anfragevolumen gedacht |
| KI-Beleg-Scan | Eigene Serverfunktion auf **Vercel** (`vercel-api/`) → **Mistral AI** (Modell `ministral-14b-2512`, überschreibbar) | Browser → Vercel → Mistral | verkleinerte Belegfotos bzw. PDF-Seiten (max. 8) oder Text digitaler PDFs; nicht gespeichert, nicht geloggt | App: `VITE_BELEG_API_URL`; Vercel: `MISTRAL_API_KEY`, `MISTRAL_MODEL`, `FIREBASE_API_KEY`, `ALLOWED_ORIGINS` |
| Token-Prüfung der Serverfunktion | Firebase Auth REST-API (Identity Toolkit) | Vercel | Firebase-ID-Token des angemeldeten Nutzers | `FIREBASE_API_KEY` |
| Beleg-Ablage | **Microsoft OneDrive** über Microsoft Graph, Login per MSAL.js (nur private Microsoft-Konten) | Browser | Beleg-Datei (Foto/PDF); gespeichert wird nur der Link | `VITE_MS_CLIENT_ID` (Entra-App-Registrierung) |

Lokal und ohne externen Dienst laufen: Feiertagsberechnung (Osterformel je Bundesland), PDF-Auslesen und -Vorschau (`pdfjs-dist`), Zusammenfassen mehrerer Fotos zu einem PDF sowie alle Quoten-, Urlaubs-, km- und Arbeitszeit-Berechnungen.

Schutzmaßnahmen: keine eigene Verschlüsselung, dafür strikte Firestore-Regeln, nur Beträge + Beleg-Verweis in der App (Originale im privaten OneDrive), minimale OneDrive-Rechte (`Files.ReadWrite.AppFolder`, das ganze OneDrive nur bei eigenem Stamm-Pfad) und KI-Schlüssel ausschließlich im Backend. Die Serverfunktion akzeptiert nur gültige Firebase-ID-Tokens, erlaubt Browser-Aufrufe nur von eingetragenen Origins und hat eine kurze Wartezeit zwischen zwei Scans.

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

Siehe [`src/types/models.ts`](src/types/models.ts) — orientiert an Abschnitt 4 der Projektbeschreibung.
