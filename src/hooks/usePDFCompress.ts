import { useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader } from '@/lib/pdf-helpers'
import { COMPRESSION_OBJECTS_PER_TICK } from '@/lib/constants'

export function usePDFCompress(files: PDFFile[]) {
  const compressFile = useCallback(async (
    fileId: string,
    level: 'high' | 'medium' | 'low',
    onProgress?: ProgressCallback,
    token?: CancellationToken,
    options?: { preserveMetadata?: boolean }
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    validatePdfHeader(file.data)

    const pdfDoc = await PDFDocument.load(file.data, { updateMetadata: true })

    onProgress?.(20)

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

    token?.throwIfCancelled()
    const bytes = await pdfDoc.save(saveOptions)

    onProgress?.(80)

    const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
    checkResult(writeResult, '写入文件失败：')

    onProgress?.(100)
    return result.filePath
  }, [files])

  return { compressFile }
}
