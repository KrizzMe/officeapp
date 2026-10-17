/**
 * Client-seitige Bildverarbeitung für Belegfotos (Issue #79, Ansatz aus Voxiefy).
 *
 * Läuft nur im Browser (Image, Canvas). Skaliert auf max. 1600 px lange Kante und
 * exportiert als JPEG — das Ergebnis geht sowohl an die Auslese-Funktion als auch
 * (identisch) nach OneDrive, spart also Upload-Volumen und hält das Body-Limit ein.
 */

export const MAX_EDGE_PX = 1600
const JPEG_QUALITY = 0.82
/** Spiegelt MAX_IMAGE_DATA_URL_LENGTH der Serverfunktion (vercel-api/api/extract-beleg.ts). */
const MAX_IMAGE_DATA_URL_LENGTH = 3_500_000

export interface CompressedImage {
  blob: Blob
  dataUrl: string
}

/** Höchstens so viele PDF-Seiten werden gelesen (jede Seite ist ein Bild im KI-Aufruf). */
export const MAX_PDF_PAGES = 3

/** Exportiert ein Canvas als JPEG (Blob + Data-URL) und prüft das Größenlimit. */
export async function canvasToCompressed(canvas: HTMLCanvasElement): Promise<CompressedImage> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Das Bild konnte nicht verarbeitet werden.')
  const dataUrl = await blobToDataUrl(blob)
  if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error('Das Foto ist auch komprimiert noch zu groß. Bitte aus etwas mehr Abstand fotografieren.')
  }
  return { blob, dataUrl }
}

/** Skaliert eine Seitengröße so, dass die lange Kante höchstens MAX_EDGE_PX beträgt. */
export function fitScale(width: number, height: number): number {
  return Math.min(1, MAX_EDGE_PX / Math.max(width, height))
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden. Bitte als JPG oder PNG aufnehmen.'))
    image.src = url
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

/** Verkleinert ein Foto auf max. 1600 px und exportiert es als JPEG. */
export async function compressImage(file: File): Promise<CompressedImage> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const scale = fitScale(image.naturalWidth, image.naturalHeight)
    const width = Math.round(image.naturalWidth * scale)
    const height = Math.round(image.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Bildbearbeitung wird von diesem Browser nicht unterstützt.')
    // Weißer Hintergrund, damit transparente PNGs im JPEG nicht schwarz werden.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    return await canvasToCompressed(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
