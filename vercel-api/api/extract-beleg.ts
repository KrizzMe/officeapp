/**
 * Office APP — POST /api/extract-beleg (Issue #79)
 *
 * Nimmt ein bereits verkleinertes Belegfoto (bzw. den Text eines digitalen PDFs) entgegen, lässt Mistral Vision
 * daraus Rechnungsdaten extrahieren und gibt validiertes JSON zurück. Das Bild
 * wird nie gespeichert und nicht geloggt: es existiert nur für die Dauer dieses
 * Aufrufs und geht nur an Mistral (Entscheidung zu #11, Punkt 5).
 *
 * Aufbau wie bei Voxiefy (/api/extract): Auth zuerst, dann Body-Validierung,
 * dann Cooldown, dann der KI-Aufruf — mit erzwungenem JSON-Schema (strict) und
 * einem Retry bei ungültiger Antwort. Bewusst ohne Abhängigkeiten.
 *
 * Umgebungsvariablen (Vercel, nie im Browser):
 *   MISTRAL_API_KEY      API-Key von Mistral
 *   MISTRAL_MODEL        optional, Standard siehe DEFAULT_MODEL
 *   FIREBASE_API_KEY     der (öffentliche) Firebase-Web-API-Key, für die Token-Prüfung
 *   ALLOWED_ORIGINS      kommagetrennte Liste erlaubter App-Origins (CORS)
 */

export const config = { maxDuration: 120 }

const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions'

/** Konkrete Version statt "-latest"-Alias (Erfahrung aus Voxiefy, Issue #52). */
const DEFAULT_MODEL = 'ministral-14b-2512'

/** Pro Bild ca. 2,5 MB; die App verkleinert vorher auf max. 1600 px. */
const MAX_IMAGE_DATA_URL_LENGTH = 3_500_000
/** Mehrseitige Belege: Seiten als Bilder (gescannte PDFs, mehrere Fotos). */
const MAX_IMAGES = 8
/** Gesamtlimit (Vercel erlaubt 4,5 MB Request-Body). */
const MAX_TOTAL_LENGTH = 4_200_000
/** Text eines digitalen PDFs (die App kürzt auf 80.000 Zeichen). */
const MAX_TEXT_LENGTH = 100_000

/** Schutz gegen Bedienfehler, kein Schutz gegen gezielten Missbrauch (wie bei Voxiefy). */
const COOLDOWN_MS = 4_000
const lastCall = new Map<string, number>()

type Art = 'handwerker' | 'werbungskosten' | 'unklar'

interface BelegResult {
  art: Art
  /** Rechnungsdatum, ISO YYYY-MM-DD. */
  datum: string | null
  aussteller: string | null
  rechnungsnummer: string | null
  beschreibung: string | null
  leistungszeitraum: string | null
  bruttoBetrag: number | null
  mwstBetrag: number | null
  arbeitskostenNetto: number | null
  materialkostenNetto: number | null
  /** Eine der übergebenen Kategorien oder null. */
  kategorie: string | null
}

const NULLABLE_STRING = { type: ['string', 'null'] }
const NULLABLE_NUMBER = { type: ['number', 'null'] }

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'art',
    'datum',
    'aussteller',
    'rechnungsnummer',
    'beschreibung',
    'leistungszeitraum',
    'bruttoBetrag',
    'mwstBetrag',
    'arbeitskostenNetto',
    'materialkostenNetto',
    'kategorie',
  ],
  properties: {
    art: { type: 'string', enum: ['handwerker', 'werbungskosten', 'unklar'] },
    datum: NULLABLE_STRING,
    aussteller: NULLABLE_STRING,
    rechnungsnummer: NULLABLE_STRING,
    beschreibung: NULLABLE_STRING,
    leistungszeitraum: NULLABLE_STRING,
    bruttoBetrag: NULLABLE_NUMBER,
    mwstBetrag: NULLABLE_NUMBER,
    arbeitskostenNetto: NULLABLE_NUMBER,
    materialkostenNetto: NULLABLE_NUMBER,
    kategorie: NULLABLE_STRING,
  },
}

function buildPrompt(kategorien: string[], fromText: boolean): string {
  const rules = [
    'Erfinde nichts. Was nicht eindeutig auf dem Beleg steht, setzt du auf null. Ein fehlender Wert ist immer besser als ein geratener.',
    'datum ist das Rechnungs- bzw. Belegdatum im Format YYYY-MM-DD (nicht das Fälligkeits- oder Lieferdatum).',
    'aussteller ist der Name der Firma bzw. des Händlers, die den Beleg ausgestellt hat (nicht der Empfänger).',
    'bruttoBetrag ist der Gesamtbetrag, der zu zahlen ist (inkl. MwSt), als Zahl mit Punkt als Dezimaltrennzeichen, ohne Währungszeichen. mwstBetrag ist der darin enthaltene Mehrwertsteuerbetrag in Euro (nicht der Prozentsatz).',
    'Bei Handwerkerrechnungen werden Arbeitskosten (Lohn, Arbeitszeit, Fahrtkosten, Anfahrt) und Materialkosten oft getrennt ausgewiesen. arbeitskostenNetto und materialkostenNetto sind die jeweiligen Summen OHNE MwSt, als Zahl. Steht eine Aufteilung nicht eindeutig auf dem Beleg, setze beide auf null.',
    'beschreibung ist eine kurze Zusammenfassung der Leistung bzw. des Artikels in höchstens 8 Wörtern (z. B. "Heizungswartung" oder "Bürostuhl").',
    'leistungszeitraum nur setzen, wenn auf dem Beleg ein Leistungsdatum oder -zeitraum steht (Freitext, z. B. "03.-05.2026"), sonst null.',
    'art: "handwerker" bei einer Rechnung für eine handwerkliche Leistung am Haus oder an der Wohnung (Reparatur, Wartung, Renovierung, Schornsteinfeger, Garten, Hausmeister), "werbungskosten" bei einem Kauf von Arbeitsmitteln, Büromaterial oder Zubehör für den Beruf, sonst "unklar".',
  ]
  if (kategorien.length > 0) {
    rules.push(
      `kategorie: wähle bei art "werbungskosten" GENAU einen dieser Werte, wörtlich übernommen: ${kategorien
        .map((k) => `"${k}"`)
        .join(', ')}. Passt keiner eindeutig, setze null. Bei anderen Arten immer null.`,
    )
  } else {
    rules.push('kategorie ist immer null.')
  }
  rules.push('Ein unleserlicher Beleg oder ein Foto ohne Rechnung ist ein gültiges Ergebnis: gib art "unklar" und alle anderen Felder null zurück.')

  return [
    fromText
      ? 'Du liest den Text einer Rechnung bzw. eines Kaufbelegs (Deutschland), der aus einem PDF extrahiert wurde (Zeilen und Spalten können durcheinander sein), und extrahierst die Rechnungsdaten als JSON.'
      : 'Du liest ein Foto oder einen Scan einer Rechnung bzw. eines Kaufbelegs (Deutschland) und extrahierst die Rechnungsdaten als JSON.',
    '',
    'Regeln, ausnahmslos:',
    ...rules.map((rule, i) => `${i + 1}. ${rule}`),
  ].join('\n')
}

// ---------------------------------------------------------------- Validierung

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string'
}

function isNullableNumber(v: unknown): v is number | null {
  return v === null || (typeof v === 'number' && Number.isFinite(v))
}

/** Gibt den bereinigten Wert oder einen Fehlertext zurück. */
function validateResult(raw: unknown): { ok: true; value: BelegResult } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Antwort ist kein Objekt.' }
  const r = raw as Record<string, unknown>

  if (r.art !== 'handwerker' && r.art !== 'werbungskosten' && r.art !== 'unklar') {
    return { ok: false, error: 'art muss "handwerker", "werbungskosten" oder "unklar" sein.' }
  }
  for (const key of ['datum', 'aussteller', 'rechnungsnummer', 'beschreibung', 'leistungszeitraum', 'kategorie']) {
    if (!isNullableString(r[key])) return { ok: false, error: `${key} muss ein String oder null sein.` }
  }
  for (const key of ['bruttoBetrag', 'mwstBetrag', 'arbeitskostenNetto', 'materialkostenNetto']) {
    if (!isNullableNumber(r[key])) return { ok: false, error: `${key} muss eine Zahl oder null sein.` }
  }
  const datum = r.datum as string | null
  if (datum !== null && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { ok: false, error: 'datum muss das Format YYYY-MM-DD haben oder null sein.' }
  }

  const clean = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
  return {
    ok: true,
    value: {
      art: r.art,
      datum,
      aussteller: clean(r.aussteller),
      rechnungsnummer: clean(r.rechnungsnummer),
      beschreibung: clean(r.beschreibung),
      leistungszeitraum: clean(r.leistungszeitraum),
      bruttoBetrag: r.bruttoBetrag as number | null,
      mwstBetrag: r.mwstBetrag as number | null,
      arbeitskostenNetto: r.arbeitskostenNetto as number | null,
      materialkostenNetto: r.materialkostenNetto as number | null,
      kategorie: clean(r.kategorie),
    },
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------- Mistral

interface MistralMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: string }>
}

class ProviderError extends Error {
  readonly code: 'provider_quota' | 'provider_error' | 'validation_failed'

  constructor(code: 'provider_quota' | 'provider_error' | 'validation_failed', message: string) {
    super(message)
    this.code = code
  }
}

async function callMistral(apiKey: string, model: string, messages: MistralMessage[]): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'beleg_extraction', schema: JSON_SCHEMA, strict: true },
      },
    }),
  })

  if (response.status === 429) {
    throw new ProviderError('provider_quota', 'Das KI-Kontingent ist gerade erschöpft. Bitte später noch einmal versuchen.')
  }
  if (!response.ok) {
    // Rohtext gehört ins Log, nicht ins UI; das Bild wird dabei nie geloggt.
    const body = await response.text().catch(() => '')
    console.error(`[mistral] HTTP ${response.status} — ${body.replace(/\s+/g, ' ').slice(0, 400)}`)
    throw new ProviderError('provider_error', 'Der KI-Dienst konnte den Beleg gerade nicht verarbeiten. Bitte später noch einmal versuchen.')
  }

  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = body.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    console.error('[mistral] Antwort ohne Text-Inhalt in choices[0].message.content')
    throw new ProviderError('provider_error', 'Der KI-Dienst hat eine unvollständige Antwort geliefert. Bitte noch einmal versuchen.')
  }
  return content
}

/** Ein Retry bei ungültiger Antwort, angereichert mit dem Fehler (robuster als ein identischer zweiter Versuch). */
async function extractBeleg(
  apiKey: string,
  model: string,
  input: { imageDataUrls: string[]; text: string | null },
  kategorien: string[],
): Promise<BelegResult> {
  const messages: MistralMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: buildPrompt(kategorien, input.text !== null) },
        ...(input.text !== null ? [{ type: 'text' as const, text: `Text der Rechnung:\n\n${input.text}` }] : []),
        ...input.imageDataUrls.map((url) => ({ type: 'image_url' as const, image_url: url })),
      ],
    },
  ]

  const firstRaw = await callMistral(apiKey, model, messages)
  const first = validateResult(safeJsonParse(firstRaw))
  if (first.ok) return first.value

  console.warn(`[mistral] schema_retry — erste Antwort ungültig: ${first.error}`)
  const retryRaw = await callMistral(apiKey, model, [
    ...messages,
    { role: 'assistant', content: firstRaw },
    {
      role: 'user',
      content: `Deine Antwort widersprach dem geforderten Schema: ${first.error}\nAntworte erneut, ausschließlich mit gültigem JSON nach dem Schema.`,
    },
  ])
  const retry = validateResult(safeJsonParse(retryRaw))
  if (retry.ok) return retry.value

  throw new ProviderError('validation_failed', 'Die KI-Antwort widersprach auch nach einem zweiten Versuch dem erwarteten Format.')
}

// ------------------------------------------------------------------------ Auth

/**
 * Prüft das Firebase-ID-Token über den Identity-Toolkit-REST-Endpunkt statt mit
 * firebase-admin (wie Voxiefy): nutzt nur den öffentlichen Web-API-Key, kein
 * neues Secret. Einziger Trade-off: kein checkRevoked.
 */
async function verifyIdToken(idToken: string): Promise<string | null> {
  const apiKey = process.env.FIREBASE_API_KEY
  if (!apiKey) return null
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) return null
  const body = (await response.json()) as { users?: Array<{ localId?: string }> }
  return body.users?.[0]?.localId ?? null
}

// ------------------------------------------------------------------------ HTTP

function corsHeaders(request: Request): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  const origin = request.headers.get('origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(request: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(request) },
  })
}

function errorResponse(request: Request, code: string, message: string, status: number): Response {
  return json(request, { error: { code, message } }, status)
}

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization') ?? ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!idToken) return errorResponse(request, 'auth', 'Nicht angemeldet.', 401)

  const uid = await verifyIdToken(idToken)
  if (!uid) return errorResponse(request, 'auth', 'Anmeldung ungültig oder abgelaufen. Bitte neu anmelden.', 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(request, 'invalid_request', 'Ungültige Anfrage.', 400)
  }
  const b = (body ?? {}) as { imageDataUrls?: unknown; imageDataUrl?: unknown; text?: unknown; kategorien?: unknown }
  // Entweder Text eines digitalen PDFs oder Bild(er); `imageDataUrl` (einzeln) bleibt als Kurzform erlaubt.
  const text = typeof b.text === 'string' && b.text.trim() !== '' ? b.text.trim() : null
  if (text !== null && text.length > MAX_TEXT_LENGTH) {
    return errorResponse(request, 'invalid_text', 'Der Beleg-Text ist zu lang.', 400)
  }
  const rawImages = Array.isArray(b.imageDataUrls) ? b.imageDataUrls : b.imageDataUrl === undefined ? [] : [b.imageDataUrl]
  const imageDataUrls = rawImages.filter((u): u is string => typeof u === 'string')
  if (
    (text === null && imageDataUrls.length === 0) ||
    imageDataUrls.length !== rawImages.length ||
    imageDataUrls.length > MAX_IMAGES ||
    imageDataUrls.some((u) => !u.startsWith('data:image/') || u.length > MAX_IMAGE_DATA_URL_LENGTH) ||
    imageDataUrls.reduce((sum, u) => sum + u.length, 0) > MAX_TOTAL_LENGTH
  ) {
    return errorResponse(request, 'invalid_image', 'Bild fehlt, ist zu groß oder hat ein unerwartetes Format.', 400)
  }
  const kategorien = Array.isArray(b.kategorien)
    ? b.kategorien.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 80).slice(0, 30)
    : []

  const now = Date.now()
  const last = lastCall.get(uid)
  if (last !== undefined && now - last < COOLDOWN_MS) {
    return errorResponse(request, 'cooldown', 'Bitte einen Moment warten, bevor der nächste Beleg gelesen wird.', 429)
  }
  lastCall.set(uid, now)

  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    console.error('MISTRAL_API_KEY fehlt')
    return errorResponse(request, 'unknown', 'Die Beleg-Auslesung ist serverseitig nicht konfiguriert.', 500)
  }

  try {
    const result = await extractBeleg(apiKey, process.env.MISTRAL_MODEL ?? DEFAULT_MODEL, { imageDataUrls, text }, kategorien)
    // Eine erfundene Kategorie wird verworfen, statt im Formular zu landen.
    if (result.kategorie !== null && !kategorien.includes(result.kategorie)) result.kategorie = null
    return json(request, result, 200)
  } catch (cause) {
    if (cause instanceof ProviderError) {
      return errorResponse(request, cause.code, cause.message, cause.code === 'provider_quota' ? 503 : 502)
    }
    console.error('extract-beleg: unerwarteter Fehler', cause)
    return errorResponse(request, 'unknown', 'Unerwarteter Fehler beim Auslesen des Belegs.', 500)
  }
}
