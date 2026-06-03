import { useCallback, useRef } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PDFFile, ProgressCallback, Annotation } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import {
  hexToRgb,
  checkResult,
  validatePdfHeader,
  assertUint8Array,
  getRequiredPdfData,
  yieldToMain,
} from '@/lib/pdf-helpers'
import * as pdfDataStore from '@/lib/pdf-data-store'
import { t, ErrorCode } from '@/lib/i18n'

export function usePDFAnnotation(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const addAnnotation = useCallback(
    async (
      fileId: string,
      annotations: Annotation[],
      onProgress?: ProgressCallback,
      token?: CancellationToken,
    ) => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) throw new Error(t(ErrorCode.FILE_NOT_FOUND))
      const fileData = getRequiredPdfData(file.id, pdfDataStore)
      validatePdfHeader(fileData)

      const result = await window.electronAPI.saveFile({
        defaultPath: `${file.name.replace(/\.pdf$/i, '')}_edited.pdf`,
      })
      if (result.canceled || !result.filePath) return null

      token?.throwIfCancelled()
      onProgress?.(10)

      let pdfDoc: PDFDocument | null = null
      try {
        pdfDoc = await PDFDocument.load(new Uint8Array(fileData), { ignoreEncryption: true })
        pdfDoc.registerFontkit(fontkit)
        const totalPages = pdfDoc.getPageCount()

        const fontBytes = await window.electronAPI.readSystemFont('simsun')
        checkResult(fontBytes, t(ErrorCode.FONT_READ_FAILED))
        const embeddedFont = await pdfDoc.embedFont(
          assertUint8Array(fontBytes, t(ErrorCode.FONT_READ_FAILED)),
          { subset: true },
        )

        for (let i = 0; i < annotations.length; i++) {
          token?.throwIfCancelled()
          await yieldToMain()
          const ann = annotations[i]
          if (ann.pageIndex < 0 || ann.pageIndex >= totalPages) {
            throw new Error(
              t(ErrorCode.ANNOTATION_PAGE_OUT_OF_BOUNDS, {
                index: i + 1,
                page: ann.pageIndex + 1,
                total: totalPages,
              }),
            )
          }
          const page = pdfDoc.getPage(ann.pageIndex)
          const color = hexToRgb(ann.color || '#000000')
          const opacity = ann.opacity ?? 1

          switch (ann.type) {
            case 'text':
              page.drawText(ann.text || '', {
                x: ann.x,
                y: ann.y,
                size: ann.fontSize || 16,
                font: embeddedFont,
                color,
                opacity,
              })
              break
            case 'rect':
              page.drawRectangle({
                x: ann.x,
                y: ann.y,
                width: ann.width || 100,
                height: ann.height || 50,
                borderColor: color,
                borderWidth: 1,
                opacity,
              })
              break
            case 'highlight':
              page.drawRectangle({
                x: ann.x,
                y: ann.y,
                width: ann.width || 100,
                height: ann.height || 20,
                color: rgb(1, 1, 0),
                opacity: 0.3,
              })
              break
            case 'circle':
              page.drawEllipse({
                x: ann.x + (ann.width || 50) / 2,
                y: ann.y + (ann.height || 50) / 2,
                xScale: (ann.width || 50) / 2,
                yScale: (ann.height || 50) / 2,
                borderColor: color,
                borderWidth: 1,
                opacity,
              })
              break
          }

          onProgress?.(Math.round(((i + 1) / annotations.length) * 80))
        }

        const bytes = await pdfDoc.save()
        const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
        checkResult(writeResult, t(ErrorCode.WRITE_FILE_FAILED))

        return result.filePath
      } finally {
        pdfDoc = null
      }
    },
    [],
  )

  return { addAnnotation }
}
