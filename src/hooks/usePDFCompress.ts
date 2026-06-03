import { useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader, yieldToMain, getRequiredPdfData } from '@/lib/pdf-helpers'
import * as pdfDataStore from '@/lib/pdf-data-store'
import { COMPRESSION_OBJECTS_PER_TICK } from '@/lib/constants'

export function usePDFCompress(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const compressFile = useCallback(
    async (
      fileId: string,
      level: 'high' | 'medium' | 'low',
      onProgress?: ProgressCallback,
      token?: CancellationToken,
      options?: { preserveMetadata?: boolean },
    ) => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) return null
      const fileData = getRequiredPdfData(file.id, pdfDataStore)
      validatePdfHeader(fileData)

      let pdfDoc: PDFDocument | null = null
      try {
        pdfDoc = await PDFDocument.load(new Uint8Array(fileData), {
          ignoreEncryption: true,
          updateMetadata: true,
        })

        onProgress?.(20)
        await yieldToMain()

        if (!options?.preserveMetadata) {
          pdfDoc.setTitle('')
          pdfDoc.setAuthor('')
          pdfDoc.setSubject('')
          pdfDoc.setKeywords([])
          pdfDoc.setProducer('')
          pdfDoc.setCreator('')
          pdfDoc.setCreationDate(new Date())
          pdfDoc.setModificationDate(new Date())
        }

        const result = await window.electronAPI.saveFile({
          defaultPath: `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`,
        })

        if (result.canceled || !result.filePath) return null

        const saveOptions: { useObjectStreams: boolean; objectsPerTick?: number } = {
          useObjectStreams: true,
          objectsPerTick: COMPRESSION_OBJECTS_PER_TICK[level],
        }

        onProgress?.(60)
        await yieldToMain()

        token?.throwIfCancelled()
        const bytes = await pdfDoc.save(saveOptions)

        onProgress?.(80)
        await yieldToMain()

        const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
        checkResult(writeResult, '写入文件失败：')

        onProgress?.(100)
        return result.filePath
      } finally {
        pdfDoc = null
      }
    },
    [],
  )

  return { compressFile }
}
