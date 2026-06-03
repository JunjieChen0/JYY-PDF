import { useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader, getRequiredPdfData } from '@/lib/pdf-helpers'
import * as pdfDataStore from '@/lib/pdf-data-store'
import { logger } from '@/lib/logger'
import { detectJavaScriptActions } from '@/lib/pdf-security'
import { t, ErrorCode } from '@/lib/i18n'

export function usePDFSignature(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const addSignature = useCallback(
    async (
      fileId: string,
      signatureDataUrl: string,
      options: { pageIndex: number; x: number; y: number; width: number; height: number },
      onProgress?: ProgressCallback,
      token?: CancellationToken,
    ) => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) throw new Error(t(ErrorCode.FILE_NOT_FOUND))
      const fileData = getRequiredPdfData(file.id, pdfDataStore)
      validatePdfHeader(fileData)

      if (options.pageIndex < 0 || options.pageIndex >= file.pageCount) {
        throw new Error(t(ErrorCode.PAGE_INDEX_OUT_OF_RANGE))
      }

      token?.throwIfCancelled()
      onProgress?.(10)

      const jsResult = await detectJavaScriptActions(fileData)
      if (jsResult.found) {
        logger.warn('PDF包含嵌入式JavaScript，已阻止签名操作以确保安全', {
          locations: jsResult.locations,
        })
        throw new Error(t(ErrorCode.PDF_HAS_JAVASCRIPT))
      }

      const result = await window.electronAPI.saveFile({
        defaultPath: `${file.name.replace(/\.pdf$/i, '')}_signed.pdf`,
      })
      if (result.canceled || !result.filePath) return null

      const filePath = result.filePath
      const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
      if (normalizedPath.includes('..') || normalizedPath.length > 260) {
        throw new Error(t(ErrorCode.INVALID_SIGNATURE_PATH))
      }
      if (!normalizedPath.endsWith('.pdf')) {
        throw new Error(t(ErrorCode.PDF_FORMAT_REQUIRED))
      }

      token?.throwIfCancelled()
      onProgress?.(20)

      let pdfDoc: PDFDocument | null = null
      try {
        pdfDoc = await PDFDocument.load(new Uint8Array(fileData), { ignoreEncryption: true })
        const base64 = signatureDataUrl.split(',')[1]
        let imgBytes: Uint8Array
        try {
          imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        } catch {
          throw new Error(t(ErrorCode.INVALID_SIGNATURE_IMAGE))
        }
        let signatureImage
        try {
          signatureImage = await pdfDoc.embedPng(imgBytes)
        } catch {
          try {
            signatureImage = await pdfDoc.embedJpg(imgBytes)
          } catch {
            throw new Error(t(ErrorCode.UNSUPPORTED_SIGNATURE_IMAGE))
          }
        }

        token?.throwIfCancelled()
        onProgress?.(50)

        const page = pdfDoc.getPage(options.pageIndex)
        const pageWidth = page.getWidth()
        const pageHeight = page.getHeight()
        if (
          options.x < 0 ||
          options.y < 0 ||
          options.x + options.width > pageWidth ||
          options.y + options.height > pageHeight
        ) {
          throw new Error(t(ErrorCode.SIGNATURE_OUT_OF_PAGE))
        }
        page.drawImage(signatureImage, {
          x: options.x,
          y: options.y,
          width: options.width,
          height: options.height,
        })

        onProgress?.(80)
        const bytes = await pdfDoc.save()

        const writeResult = await window.electronAPI.writeFile(filePath, bytes)
        checkResult(writeResult, '写入文件失败：')

        return result.filePath
      } finally {
        pdfDoc = null
      }
    },
    [],
  )

  return { addSignature }
}
