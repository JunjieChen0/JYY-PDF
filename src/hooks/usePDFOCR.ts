import { useCallback, useRef } from 'react'
import { getPdfjsLib, PDFJS_CONFIG } from '@/lib/pdfjs-config'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, getRequiredPdfData } from '@/lib/pdf-helpers'
import { t, ErrorCode } from '@/lib/i18n'
import * as pdfDataStore from '@/lib/pdf-data-store'

const OCR_PAGE_TIMEOUT_MS = 60000

export function usePDFOCR(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const ocrPDF = useCallback(
    async (
      fileId: string,
      language: string = 'chi_sim+eng',
      onProgress?: ProgressCallback,
      token?: CancellationToken,
    ) => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) throw new Error(t(ErrorCode.FILE_NOT_FOUND))

      const pdfjsLib = getPdfjsLib()
      const fileData = getRequiredPdfData(file.id, pdfDataStore)
      const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(fileData), ...PDFJS_CONFIG })
        .promise
      const totalPages = pdfDoc.numPages

      let fullText = ''
      let currentPage = 0

      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker(language, 1, {
        workerPath: './tesseract/worker.min.js',
        corePath: './tesseract/core/',
        langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data',
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            const pageProgress = Math.round(((currentPage - 1 + m.progress) / totalPages) * 100)
            onProgress?.(pageProgress)
          }
        },
      })

      const withTimeout = <T>(
        promise: Promise<T>,
        timeoutMs: number,
        label: string,
      ): Promise<T> => {
        let settled = false
        let timer: ReturnType<typeof setTimeout>
        const race = Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              if (!settled) {
                settled = true
                reject(new Error(t(ErrorCode.OCR_TIMEOUT, { label, seconds: timeoutMs / 1000 })))
              }
            }, timeoutMs)
            token?.onCancel(() => {
              if (!settled) {
                settled = true
                clearTimeout(timer)
                reject(new Error(t(ErrorCode.CANCELLED)))
              }
            })
          }),
        ])
        return race.finally(() => {
          settled = true
          clearTimeout(timer)
        })
      }

      try {
        for (let i = 1; i <= totalPages; i++) {
          token?.throwIfCancelled()
          currentPage = i
          const page = await pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale: 2.0 })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error(t(ErrorCode.CANVAS_CONTEXT_FAILED))

          try {
            await page.render({ canvasContext: ctx, viewport }).promise
            const {
              data: { text },
            } = await withTimeout(worker.recognize(canvas), OCR_PAGE_TIMEOUT_MS, t(ErrorCode.OCR_PAGE_LABEL, { page: i }))
            fullText += (i > 1 ? '\n' : '') + `${t('OCR_PAGE_HEADER', { page: i })}\n${text}\n`
          } finally {
            canvas.width = 0
            canvas.height = 0
          }
        }
      } finally {
        await worker.terminate()
        pdfDoc.destroy()
      }

      const result = await window.electronAPI.saveFile({
        defaultPath: `${file.name.replace(/\.pdf$/i, '')}_ocr.txt`,
        filters: [{ name: t('TEXT_FILES'), extensions: ['txt'] }],
      })

      if (result.canceled || !result.filePath) return null

      const encoder = new TextEncoder()
      const writeResult = await window.electronAPI.writeFile(
        result.filePath,
        encoder.encode(fullText),
      )
      checkResult(writeResult, t(ErrorCode.WRITE_FILE_FAILED))

      return result.filePath
    },
    [],
  )

  return { ocrPDF }
}
