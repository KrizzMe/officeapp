# Office App

Anwesenheits- & Urlaubs-Tracker (Kalender-App). Löst eine jährlich neu aufgesetzte Excel-Datei ab, die zur Berechnung der Homeoffice-/Büro-Anwesenheitsquote (40/60-Regel), zum Tracking von Urlaubskontingenten und zur Erfassung der Pendlerstrecke für die Steuererklärung diente.

Vollständige Projektbeschreibung: [`docs/projektbeschreibung-anwesenheits-app.md`](docs/projektbeschreibung-anwesenheits-app.md).

## Status

MVP in Aufbau. Aktueller Stand: Projekt-Scaffold (Vite + React + TypeScript), Datenmodell als TS-Typen, Firebase-Grundgerüst — noch keine UI-Logik.

## Tech-Stack

- **Frontend:** React + TypeScript + Vite
- **Auth:** Firebase Auth (Google Sign-In)
- **Datenhaltung:** Firestore
- **Hosting:** Firebase Hosting

## Setup

```bash
npm install
cp .env.example .env   # Firebase-Projekt-Zugangsdaten eintragen
npm run dev
```

## Firebase-Projekt verbinden

1. Firebase-Projekt in der [Firebase Console](https://console.firebase.google.com/) anlegen
2. Google Sign-In unter Authentication aktivieren
3. Firestore-Datenbank anlegen
4. Web-App-Zugangsdaten aus den Projekteinstellungen in `.env` eintragen
5. `firebase deploy` deployt Hosting, Firestore-Regeln (`firestore.rules`) und Indexe (`firestore.indexes.json`)

## Datenmodell

Siehe [`src/types/models.ts`](src/types/models.ts) — orientiert an Abschnitt 4 der Projektbeschreibung, jedoch bewusst nicht 1:1 aus der Referenz-Excel übernommen.

## Referenz

[`docs/Steuern_2026.xlsx`](docs/Steuern_2026.xlsx) — bisherige Excel-Lösung mit allen Formeln für Anwesenheitsquote, Urlaubszählung und Wegstrecken-Zuordnung. Enthält reale Privatadressen, daher `.gitignore`d — nur lokale Referenz.

## Nicht Teil des MVP

Siehe Abschnitt 8 der Projektbeschreibung: Steuerteil (Handwerkerabrechnungen, Werbungskosten), Verschlüsselung für Steuerdaten, gemeinsame Kalenderansicht.
