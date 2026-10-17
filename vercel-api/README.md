# vercel-api — Beleg-Auslesung (Issue #79)

Kleine Serverfunktion, die ein Belegfoto per Mistral Vision in Rechnungsdaten
übersetzt. Läuft als **eigenes Vercel-Projekt** neben dem Firebase Hosting der App
(die App selbst bleibt unverändert auf Firebase).

## Einrichtung (einmalig)

1. In Vercel ein neues Projekt aus diesem Repo anlegen, **Root Directory: `vercel-api`**,
   Framework Preset „Other“.
2. Umgebungsvariablen (Production):

   | Variable | Inhalt |
   |---|---|
   | `MISTRAL_API_KEY` | API-Key von Mistral |
   | `FIREBASE_API_KEY` | der öffentliche Firebase-Web-API-Key (= `VITE_FIREBASE_API_KEY`) |
   | `ALLOWED_ORIGINS` | erlaubte App-Origins, kommagetrennt, z. B. `https://<prod-domain>,http://localhost:5173` |
   | `MISTRAL_MODEL` | optional, Standard `ministral-14b-2512` |

3. In der App (`.env.local` bzw. GitHub-Secret für den Build): `VITE_BELEG_API_URL` auf die
   Vercel-URL setzen, z. B. `https://officeapp-api.vercel.app/api/extract-beleg`.

## Endpunkt

`POST /api/extract-beleg` mit `Authorization: Bearer <Firebase-ID-Token>` und Body
`{ "imageDataUrls": ["data:image/jpeg;base64,…"], "kategorien": ["Büromaterial", …] }` (bis zu 3 Bilder, z. B. die Seiten eines PDFs).
Antwort: siehe `BelegResult` in `api/extract-beleg.ts`.

Das Bild wird weder gespeichert noch geloggt.
