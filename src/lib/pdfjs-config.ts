import * as pdfjsLib from 'pdfjs-dist'

let workerInitialized = false

export function initPdfjsWorker() {
  if (workerInitialized) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
  workerInitialized = true
}

export function getPdfjsLib() {
  initPdfjsWorker()
  return pdfjsLib
}

export const PDFJS_CONFIG = {
  cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/',
}
