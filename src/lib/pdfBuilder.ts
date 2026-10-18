/**
 * Baut aus mehreren JPEG-Fotos ein mehrseitiges PDF (Issue #79), damit eine mehrseitige Rechnung
 * als EINE Datei in OneDrive landet. Bewusst ohne Bibliothek: Jede Seite ist ein JPEG, das
 * unverändert (DCTDecode) eingebettet wird — kein Neukodieren, keine Qualitätsverluste.
 */

export interface JpegPage {
  blob: Blob
  /** Pixelmaße des JPEGs. */
  width: number
  height: number
}

/** Seitengröße in PDF-Punkt: Annahme ca. 150 dpi (1 px = 0,48 pt), ergibt etwa A4-Format bei 1600 px. */
const PT_PER_PX = 0.48

export async function jpegsToPdf(pages: JpegPage[]): Promise<Blob> {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  let offset = 0
  const offsets: number[] = []

  const push = (data: Uint8Array) => {
    parts.push(data)
    offset += data.length
  }
  const text = (s: string) => push(encoder.encode(s))
  const startObject = (n: number) => {
    offsets[n] = offset
    text(`${n} 0 obj\n`)
  }

  // Objekt 1: Katalog, 2: Seitenbaum, danach je Seite: Seite, Inhalt, Bild.
  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])) // %PDF-1.4 + Binär-Kommentar
  startObject(1)
  text('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')
  startObject(2)
  text(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`)

  for (let i = 0; i < pages.length; i++) {
    const { blob, width, height } = pages[i]
    const w = Math.round(width * PT_PER_PX * 100) / 100
    const h = Math.round(height * PT_PER_PX * 100) / 100
    const pageObj = 3 + 3 * i
    const contentObj = pageObj + 1
    const imageObj = pageObj + 2
    const jpeg = new Uint8Array(await blob.arrayBuffer())

    startObject(pageObj)
    text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`,
    )

    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`
    startObject(contentObj)
    text(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)

    startObject(imageObj)
    text(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    )
    push(jpeg)
    text('\nendstream\nendobj\n')
  }

  const objectCount = 2 + 3 * pages.length
  const xrefOffset = offset
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`
  for (let n = 1; n <= objectCount; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  text(`${xref}trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
