import { canvasToCompressed, MAX_EDGE_PX, MAX_PDF_PAGES, type CompressedImage } from './image'

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/**
 * Rendert die ersten Seiten (max. MAX_PDF_PAGES) eines PDFs als JPEG-Bilder (Issue #79).
 * Die KI liest Bilder, das PDF selbst wird unverändert nach OneDrive hochgeladen.
 * pdf.js wird erst beim ersten PDF nachgeladen, damit es das Start-Bundle nicht vergrößert.
 */
export async function renderPdfPages(file: File): Promise<CompressedImage[]> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  let pdf
  try {
    pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  } catch {
    throw new Error('Das PDF konnte nicht gelesen werden (beschädigt oder passwortgeschützt?).')
  }

  try {
    const pages: CompressedImage[] = []
    const count = Math.min(pdf.numPages, MAX_PDF_PAGES)
    for (let i = 1; i <= count; i++) {
      const page = await pdf.getPage(i)
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
      pages.push(await canvasToCompressed(canvas))
    }
    return pages
  } finally {
    await pdf.destroy()
  }
}
