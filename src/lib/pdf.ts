import { canvasToCompressed, MAX_EDGE_PX, MAX_PDF_PAGES, type CompressedImage } from './image'

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/** Ab so vielen Zeichen gilt ein PDF als „digital“ (hat eine Textebene) statt als Scan. */
const MIN_TEXT_LENGTH = 80
/** Mehr Text als das braucht keine Rechnung; begrenzt Aufrufgröße und Kosten. */
const MAX_TEXT_LENGTH = 20_000

export interface PdfContent {
  /** Text der Textebene, wenn das PDF digital erzeugt wurde; sonst null (Scan). */
  text: string | null
  /** Seitenbilder: bei Text nur die erste Seite (Vorschau), bei einem Scan bis zu MAX_PDF_PAGES für die KI. */
  pages: CompressedImage[]
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

async function renderPage(page: PdfPage): Promise<CompressedImage> {
  const base = page.getViewport({ scale: 1 })
  // PDF-Seiten sind in Punkt (A4 ≈ 595×842) angegeben: auf die lange Kante MAX_EDGE_PX hochrechnen.
  const viewport = page.getViewport({ scale: MAX_EDGE_PX / Math.max(base.width, base.height) })
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
 * der Text direkt ausgelesen — schneller, billiger und genauer als eine Bilderkennung. Nur bei
 * Scans ohne Text werden die ersten Seiten als Bilder gerendert. Das PDF selbst geht unverändert
 * nach OneDrive. pdf.js wird erst beim ersten PDF nachgeladen.
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
    const count = Math.min(pdf.numPages, MAX_PDF_PAGES)
    const texts: string[] = []
    for (let i = 1; i <= count; i++) texts.push(await pageText(await pdf.getPage(i)))
    const text = texts.join('\n\n').trim()

    if (text.length >= MIN_TEXT_LENGTH) {
      return { text: text.slice(0, MAX_TEXT_LENGTH), pages: [await renderPage(await pdf.getPage(1))] }
    }
    const pages: CompressedImage[] = []
    for (let i = 1; i <= count; i++) pages.push(await renderPage(await pdf.getPage(i)))
    return { text: null, pages }
  } finally {
    await pdf.destroy()
  }
}
