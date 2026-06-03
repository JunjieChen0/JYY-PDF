import * as pdfjsLib from 'pdfjs-dist'

let workerInitialized = false

export function initPdfjsWorker() {
  if (workerInitialized) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  workerInitialized = true
}

export function getPdfjsLib() {
  initPdfjsWorker()
  return pdfjsLib
}

const pdfjsVersion = (pdfjsLib as unknown as { version?: string }).version || '4.0.379'

export const PDFJS_CONFIG = {
  cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/standard_fonts/`,
}
