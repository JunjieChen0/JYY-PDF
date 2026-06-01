import { useCallback } from 'react'
import { getPdfjsLib } from '@/lib/pdfjs-config'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult } from '@/lib/pdf-helpers'

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
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(file.data) }).promise
    const totalPages = pdfDoc.numPages

    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker(language, 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          const pageProgress = Math.round(((currentPage - 1 + m.progress) / totalPages) * 100)
          onProgress?.(pageProgress)
        }
      }
    })

    let fullText = ''
    let currentPage = 0

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

        await page.render({ canvasContext: ctx, viewport }).promise

        const { data: { text } } = await worker.recognize(canvas)
        fullText += (i > 1 ? '\n' : '') + `--- 第${i}页 ---\n${text}\n`

        canvas.width = 0
        canvas.height = 0
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
