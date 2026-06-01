import { useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader } from '@/lib/pdf-helpers'

export function usePDFMerge(files: PDFFile[]) {
  const mergeFiles = useCallback(async (onProgress?: ProgressCallback, token?: CancellationToken) => {
    if (files.length < 2) return null

    const result = await window.electronAPI.saveFile({
      defaultPath: 'merged.pdf',
    })

    if (result.canceled || !result.filePath) return null

    const mergedPdf = await PDFDocument.create()

    for (let i = 0; i < files.length; i++) {
      token?.throwIfCancelled()
      const file = files[i]
      validatePdfHeader(file.data)
      const pdfDoc = await PDFDocument.load(file.data)
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
      copiedPages.forEach(page => mergedPdf.addPage(page))

      onProgress?.(Math.round(((i + 1) / files.length) * 100))
    }

    token?.throwIfCancelled()
    const mergedBytes = await mergedPdf.save()
    const writeResult = await window.electronAPI.writeFile(result.filePath, mergedBytes)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  return { mergeFiles }
}
