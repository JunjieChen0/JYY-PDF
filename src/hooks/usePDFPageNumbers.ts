import { useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PDFFile, ProgressCallback, PageNumberPosition } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import {
  hexToRgb,
  estimateTextWidth,
  checkResult,
  validatePdfHeader,
  assertUint8Array,
  getRequiredPdfData,
  yieldToMain,
} from '@/lib/pdf-helpers'
import * as pdfDataStore from '@/lib/pdf-data-store'
import {
  DEFAULT_PAGE_NUMBER_FONT_SIZE,
  DEFAULT_PAGE_NUMBER_START,
  DEFAULT_PAGE_NUMBER_MARGIN,
  DEFAULT_PAGE_NUMBER_TEXT_MARGIN,
} from '@/lib/constants'

export function usePDFPageNumbers(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const addPageNumbers = useCallback(
    async (
      fileId: string,
      options: {
        position?: PageNumberPosition
        startNumber?: number
        fontSize?: number
        color?: string
        format?: 'simple' | 'ofTotal' | 'custom'
        prefix?: string
      },
      onProgress?: ProgressCallback,
      token?: CancellationToken,
    ) => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) return null
      const fileData = getRequiredPdfData(file.id, pdfDataStore)
      validatePdfHeader(fileData)

      let pdfDoc: PDFDocument | null = null
      try {
        pdfDoc = await PDFDocument.load(new Uint8Array(fileData), { ignoreEncryption: true })
        pdfDoc.registerFontkit(fontkit)
        const pages = pdfDoc.getPages()
        const totalPages = pages.length

        const result = await window.electronAPI.saveFile({
          defaultPath: `${file.name.replace(/\.pdf$/i, '')}_paged.pdf`,
        })

        if (result.canceled || !result.filePath) return null

        const {
          position = 'bottom-center',
          startNumber = DEFAULT_PAGE_NUMBER_START,
          fontSize = DEFAULT_PAGE_NUMBER_FONT_SIZE,
          color = '#000000',
          format = 'simple',
          prefix = '',
        } = options

        const fontBytes = await window.electronAPI.readSystemFont('simsun')
        checkResult(fontBytes, '读取系统字体失败，请确保系统已安装宋体字体')
        const embeddedFont = await pdfDoc.embedFont(
          assertUint8Array(fontBytes, '读取系统字体失败'),
          { subset: true },
        )

        for (let i = 0; i < pages.length; i++) {
          token?.throwIfCancelled()
          await yieldToMain()
          const page = pages[i]
          const { width, height } = page.getSize()
          const pageNum = startNumber + i

          let pageText = ''
          switch (format) {
            case 'ofTotal':
              pageText = `${pageNum} / ${totalPages}`
              break
            case 'custom':
              pageText = `${prefix}${pageNum}`
              break
            default:
              pageText = `${pageNum}`
          }

          const textWidth = estimateTextWidth(pageText, fontSize)

          let x = 0,
            y = 0
          switch (position) {
            case 'top-left':
              x = DEFAULT_PAGE_NUMBER_TEXT_MARGIN
              y = height - DEFAULT_PAGE_NUMBER_MARGIN
              break
            case 'top-center':
              x = width / 2 - textWidth / 2
              y = height - DEFAULT_PAGE_NUMBER_MARGIN
              break
            case 'top-right':
              x = width - DEFAULT_PAGE_NUMBER_TEXT_MARGIN - textWidth
              y = height - DEFAULT_PAGE_NUMBER_MARGIN
              break
            case 'bottom-left':
              x = DEFAULT_PAGE_NUMBER_TEXT_MARGIN
              y = DEFAULT_PAGE_NUMBER_MARGIN
              break
            case 'bottom-center':
              x = width / 2 - textWidth / 2
              y = DEFAULT_PAGE_NUMBER_MARGIN
              break
            case 'bottom-right':
              x = width - DEFAULT_PAGE_NUMBER_TEXT_MARGIN - textWidth
              y = DEFAULT_PAGE_NUMBER_MARGIN
              break
            default:
              x = width / 2 - textWidth / 2
              y = DEFAULT_PAGE_NUMBER_MARGIN
          }

          page.drawText(pageText, {
            x,
            y,
            size: fontSize,
            font: embeddedFont,
            color: hexToRgb(color),
            opacity: 1,
          })

          onProgress?.(Math.round(((i + 1) / pages.length) * 100))
        }

        const bytes = await pdfDoc.save()
        const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
        checkResult(writeResult, '写入文件失败：')

        return result.filePath
      } finally {
        pdfDoc = null
      }
    },
    [],
  )

  return { addPageNumbers }
}
