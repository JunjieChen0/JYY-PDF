import { useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader, getRequiredPdfData, yieldToMain } from '@/lib/pdf-helpers'
import * as pdfDataStore from '@/lib/pdf-data-store'

export function usePDFMerge(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const mergeFiles = useCallback(
    async (onProgress?: ProgressCallback, token?: CancellationToken) => {
      const currentFiles = filesRef.current
      if (currentFiles.length < 2) return null

      const result = await window.electronAPI.saveFile({
        defaultPath: 'merged.pdf',
      })

      if (result.canceled || !result.filePath) return null

      const mergedPdf = await PDFDocument.create()

      for (let i = 0; i < currentFiles.length; i++) {
        token?.throwIfCancelled()
        await yieldToMain()
        const file = currentFiles[i]
        const fileData = getRequiredPdfData(file.id, pdfDataStore)
        validatePdfHeader(fileData)
        let pdfDoc: PDFDocument | null = null
        try {
          pdfDoc = await PDFDocument.load(new Uint8Array(fileData), { ignoreEncryption: true })
          const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
          copiedPages.forEach((page) => mergedPdf.addPage(page))

          onProgress?.(Math.round(((i + 1) / currentFiles.length) * 100))
        } finally {
          pdfDoc = null
        }
      }

      token?.throwIfCancelled()
      const mergedBytes = await mergedPdf.save()
      const writeResult = await window.electronAPI.writeFile(result.filePath, mergedBytes)
      checkResult(writeResult, '写入文件失败：')

      return result.filePath
    },
    [],
  )

  return { mergeFiles }
}
