import { useCallback } from 'react'
import { getPdfjsLib, PDFJS_CONFIG } from '@/lib/pdfjs-config'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult } from '@/lib/pdf-helpers'

const OCR_PAGE_TIMEOUT_MS = 60000

export function usePDFOCR(files: PDFFile[]) {
  const ocrPDF = useCallback(async (
    fileId: string,
    language: string = 'chi_sim+eng',
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) throw new Error('文件不存在')

    const pdfjsLib = getPdfjsLib()
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(file.data), ...PDFJS_CONFIG }).promise
    const totalPages = pdfDoc.numPages

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
      }
    })

    let fullText = ''
    let currentPage = 0

    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
      let settled = false
      let timer: ReturnType<typeof setTimeout>
      const race = Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            if (!settled) {
              settled = true
              reject(new Error(`${label}超时（${timeoutMs / 1000}秒）`))
            }
          }, timeoutMs)
          token?.onCancel(() => {
            if (!settled) {
              settled = true
              clearTimeout(timer)
              reject(new Error('操作已取消'))
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
        if (!ctx) throw new Error('无法创建 Canvas 上下文')

        try {
          await page.render({ canvasContext: ctx, viewport }).promise
          const { data: { text } } = await withTimeout(
            worker.recognize(canvas),
            OCR_PAGE_TIMEOUT_MS,
            `第${i}页OCR识别`
          )
          fullText += (i > 1 ? '\n' : '') + `--- 第${i}页 ---\n${text}\n`
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
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    })

    if (result.canceled || !result.filePath) return null

    const encoder = new TextEncoder()
    const writeResult = await window.electronAPI.writeFile(result.filePath, encoder.encode(fullText))
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  return { ocrPDF }
}
