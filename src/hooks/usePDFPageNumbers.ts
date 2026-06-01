import { useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { PDFFile, ProgressCallback, PageNumberPosition } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { hexToRgb, estimateTextWidth, checkResult, validatePdfHeader } from '@/lib/pdf-helpers'
import {
  DEFAULT_PAGE_NUMBER_FONT_SIZE,
  DEFAULT_PAGE_NUMBER_START,
  DEFAULT_PAGE_NUMBER_MARGIN,
  DEFAULT_PAGE_NUMBER_TEXT_MARGIN,
} from '@/lib/constants'

export function usePDFPageNumbers(files: PDFFile[]) {
  const addPageNumbers = useCallback(async (
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
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_paged.pdf`,
    })

    if (result.canceled || !result.filePath) return null

    validatePdfHeader(file.data)
    const pdfDoc = await PDFDocument.load(new Uint8Array(file.data), { ignoreEncryption: true })
    const pages = pdfDoc.getPages()
    const totalPages = pages.length
    const {
      position = 'bottom-center',
      startNumber = DEFAULT_PAGE_NUMBER_START,
      fontSize = DEFAULT_PAGE_NUMBER_FONT_SIZE,
      color = '#000000',
      format = 'simple',
      prefix = ''
    } = options

    for (let i = 0; i < pages.length; i++) {
      token?.throwIfCancelled()
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

      let x = 0, y = 0
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
        color: hexToRgb(color),
        opacity: 1,
      })

      onProgress?.(Math.round(((i + 1) / pages.length) * 100))
    }

    const bytes = await pdfDoc.save()
    const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  return { addPageNumbers }
}
