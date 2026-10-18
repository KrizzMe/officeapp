import { canvasToCompressed, MAX_PDF_SCAN_PAGES, MAX_SCAN_TOTAL_LENGTH, type CompressedImage } from './image'

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/** Ab so vielen Zeichen gilt ein PDF als „digital“ (hat eine Textebene) statt als Scan. */
const MIN_TEXT_LENGTH = 80
/** Obergrenze für den Text einer Rechnung; schützt Aufrufgröße und Kosten (Server erlaubt etwas mehr). */
const MAX_TEXT_LENGTH = 80_000
/** Lange Kante der Seitenbilder bei Scans, von groß nach klein: so viele Seiten wie möglich in einem Aufruf. */
const SCAN_EDGES = [1600, 1300, 1000, 800]

export interface PdfContent {
  /** Text der Textebene, wenn das PDF digital erzeugt wurde; sonst null (Scan). */
  text: string | null
  /** Seitenbilder: bei Text nur die erste Seite (Vorschau), bei einem Scan alle (bis MAX_PDF_SCAN_PAGES) für die KI. */
  pages: CompressedImage[]
  /** Seitenzahl des PDFs. */
  totalPages: number
  /** Nicht alles wurde gelesen (zu viele Seiten bzw. zu viel Text). */
  truncated: boolean
}

type PdfjsModule = typeof import('pdfjs-dist')
type PdfDocument = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>

/** Text einer Seite, Zeilenumbrüche bleiben erhalten (Tabellenzeilen einer Rechnung bleiben so beisammen). */
async function pageText(page: PdfPage): Promise<string> {
  const content = await page.getTextContent()
  let text = ''
  for (const item of content.items) {
    if (!('str' in item)) continue
    text += item.str
    text += item.hasEOL ? '\n' : ' '
  }
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

async function renderPage(page: PdfPage, maxEdge: number): Promise<CompressedImage> {
  const base = page.getViewport({ scale: 1 })
  // PDF-Seiten sind in Punkt (A4 ≈ 595×842) angegeben: auf die lange Kante maxEdge hochrechnen.
  const viewport = page.getViewport({ scale: maxEdge / Math.max(base.width, base.height) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Bildbearbeitung wird von diesem Browser nicht unterstützt.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return canvasToCompressed(canvas)
}

/**
 * Liest ein PDF (Issue #79): Hat es eine Textebene (die meisten Rechnungen per Mail/Download), wird
 * der Text ALLER Seiten direkt ausgelesen — schneller, billiger und genauer als eine
 * Bilderkennung. Nur bei Scans ohne Text werden die Seiten als Bilder gerendert (bis
 * MAX_PDF_SCAN_PAGES, je mehr Seiten, desto kleiner die Bilder, damit alles in einen Aufruf passt).
 * Das PDF selbst geht unverändert nach OneDrive. pdf.js wird erst beim ersten PDF nachgeladen.
 */
export async function readPdf(file: File): Promise<PdfContent> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  let pdf: PdfDocument
  try {
    pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  } catch {
    throw new Error('Das PDF konnte nicht gelesen werden (beschädigt oder passwortgeschützt?).')
  }

  try {
    const totalPages = pdf.numPages
    const texts: string[] = []
    let length = 0
    let textTruncated = false
    for (let i = 1; i <= totalPages; i++) {
      const t = await pageText(await pdf.getPage(i))
      texts.push(t)
      length += t.length
      if (length > MAX_TEXT_LENGTH) {
        textTruncated = true
        break
      }
    }
    const text = texts.join('\n\n').trim()

    if (text.length >= MIN_TEXT_LENGTH) {
      return {
        text: text.slice(0, MAX_TEXT_LENGTH),
        pages: [await renderPage(await pdf.getPage(1), SCAN_EDGES[0])],
        totalPages,
        truncated: textTruncated,
      }
    }

    // Scan: Seitenbilder; Kantenlänge verkleinern, bis alle Seiten zusammen ins Größenlimit passen.
    const count = Math.min(totalPages, MAX_PDF_SCAN_PAGES)
    let pages: CompressedImage[] = []
    for (const edge of SCAN_EDGES) {
      pages = []
      let total = 0
      for (let i = 1; i <= count; i++) {
        const image = await renderPage(await pdf.getPage(i), edge)
        pages.push(image)
        total += image.dataUrl.length
      }
      if (total <= MAX_SCAN_TOTAL_LENGTH) break
    }
    return { text: null, pages, totalPages, truncated: totalPages > count }
  } finally {
    await pdf.destroy()
  }
}
