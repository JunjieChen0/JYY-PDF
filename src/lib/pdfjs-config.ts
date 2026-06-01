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
