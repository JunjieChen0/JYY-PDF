import { useCallback, useRef } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import { getPageRange } from '@/lib/utils'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader, getRequiredPdfData, yieldToMain } from '@/lib/pdf-helpers'
import { t, ErrorCode } from '@/lib/i18n'
import * as pdfDataStore from '@/lib/pdf-data-store'

export function usePDFPages(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const splitFile = useCallback(
    async (
      fileId: string,
      rangeStr: string,
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
        const maxPages = pdfDoc.getPageCount()

        const results: string[] = []
        const ranges = rangeStr
          .split(',')
          .map((r) => r.trim())
          .filter((r) => r.length > 0)
        const rangePagesList = ranges.map((r) => getPageRange(r, maxPages))
        const totalPagesToProcess = rangePagesList.reduce((sum, p) => sum + p.length, 0)
        if (totalPagesToProcess === 0) return null

        let processedPages = 0
        for (let i = 0; i < ranges.length; i++) {
          token?.throwIfCancelled()
          await yieldToMain()
          const result = await window.electronAPI.saveFile({
            defaultPath: `${file.name.replace(/\.pdf$/i, '')}_part${i + 1}.pdf`,
          })

          if (result.canceled || !result.filePath) {
            if (i < ranges.length - 1) {
              onProgress?.(Math.round((processedPages / totalPagesToProcess) * 100))
            }
            continue
          }

          const newPdf = await PDFDocument.create()
          const rangePages = rangePagesList[i]
          const copiedPages = await newPdf.copyPages(pdfDoc, rangePages)
          copiedPages.forEach((page) => newPdf.addPage(page))

          token?.throwIfCancelled()
          const bytes = await newPdf.save()
          const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
          checkResult(writeResult, t(ErrorCode.WRITE_FILE_FAILED))
          results.push(result.filePath)

          processedPages += rangePages.length
          onProgress?.(Math.round((processedPages / totalPagesToProcess) * 100))
        }

        return results
      } finally {
        pdfDoc = null
      }
    },
    [],
  )

  const rotatePages = useCallback(
    async (
      fileId: string,
      rangeStr: string,
      angle: number,
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
        const maxPages = pdfDoc.getPageCount()
        const pages = getPageRange(rangeStr, maxPages)

        if (pages.length === 0) return null

        const result = await window.electronAPI.saveFile({
          defaultPath: `${file.name.replace(/\.pdf$/i, '')}_rotated.pdf`,
        })

        if (result.canceled || !result.filePath) return null

        const normalizedAngle = ((angle % 360) + 360) % 360
        for (let i = 0; i < pages.length; i++) {
          token?.throwIfCancelled()
          await yieldToMain()
          const page = pdfDoc.getPage(pages[i])
          const currentRotation = page.getRotation().angle
          const newRotation = (currentRotation + normalizedAngle) % 360
          page.setRotation(degrees(newRotation))
          onProgress?.(Math.round(((i + 1) / pages.length) * 100))
        }

        token?.throwIfCancelled()
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

  const deletePages = useCallback(
    async (
      fileId: string,
      rangeStr: string,
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
        const maxPages = pdfDoc.getPageCount()
        const pagesToDelete = new Set(getPageRange(rangeStr, maxPages))

        if (pagesToDelete.size === 0) return null
        if (pagesToDelete.size >= maxPages) {
          throw new Error(t(ErrorCode.CANNOT_DELETE_ALL_PAGES))
        }

        const result = await window.electronAPI.saveFile({
          defaultPath: `${file.name.replace(/\.pdf$/i, '')}_deleted.pdf`,
        })

        if (result.canceled || !result.filePath) return null

        const newPdf = await PDFDocument.create()
        const pagesToKeep = Array.from({ length: maxPages }, (_, i) => i).filter(
          (i) => !pagesToDelete.has(i),
        )

        const copiedPages = await newPdf.copyPages(pdfDoc, pagesToKeep)
        copiedPages.forEach((page, i) => {
          newPdf.addPage(page)
          const processed = pagesToDelete.size + i + 1
          onProgress?.(Math.round((processed / maxPages) * 100))
        })

        token?.throwIfCancelled()
        const bytes = await newPdf.save()
        const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
        checkResult(writeResult, t(ErrorCode.WRITE_FILE_FAILED))

        return result.filePath
      } finally {
        pdfDoc = null
      }
    },
    [],
  )

  const extractPages = useCallback(
    async (
      fileId: string,
      rangeStr: string,
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
        const maxPages = pdfDoc.getPageCount()
        const pages = getPageRange(rangeStr, maxPages)

        if (pages.length === 0) return null

        const result = await window.electronAPI.saveFile({
          defaultPath: `${file.name.replace(/\.pdf$/i, '')}_extracted.pdf`,
        })

        if (result.canceled || !result.filePath) return null

        const newPdf = await PDFDocument.create()
        const copiedPages = await newPdf.copyPages(pdfDoc, pages)
        copiedPages.forEach((page, i) => {
          newPdf.addPage(page)
          onProgress?.(Math.round(((i + 1) / pages.length) * 100))
        })

        token?.throwIfCancelled()
        const bytes = await newPdf.save()
        const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
        checkResult(writeResult, t(ErrorCode.WRITE_FILE_FAILED))

        return result.filePath
      } finally {
        pdfDoc = null
      }
    },
    [],
  )

  return { splitFile, rotatePages, deletePages, extractPages }
}
