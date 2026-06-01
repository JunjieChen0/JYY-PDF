import { useCallback } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import { getPageRange } from '@/lib/utils'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader } from '@/lib/pdf-helpers'

export function usePDFPages(files: PDFFile[]) {
  const splitFile = useCallback(async (
    fileId: string,
    rangeStr: string,
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    validatePdfHeader(file.data)

    const pdfDoc = await PDFDocument.load(file.data)
    const maxPages = pdfDoc.getPageCount()
    const pages = getPageRange(rangeStr, maxPages)

    if (pages.length === 0) return null

    const results: string[] = []
    const ranges = rangeStr.split(',').map(r => r.trim())

    for (let i = 0; i < ranges.length; i++) {
      token?.throwIfCancelled()
      const range = ranges[i]
      const result = await window.electronAPI.saveFile({
        defaultPath: `${file.name.replace(/\.pdf$/i, '')}_part${i + 1}.pdf`,
      })

      if (result.canceled || !result.filePath) continue

      const newPdf = await PDFDocument.create()
      const rangePages = getPageRange(range, maxPages)
      const copiedPages = await newPdf.copyPages(pdfDoc, rangePages)
      copiedPages.forEach(page => newPdf.addPage(page))

      token?.throwIfCancelled()
      const bytes = await newPdf.save()
      const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
      checkResult(writeResult, '写入文件失败：')
      results.push(result.filePath)

      onProgress?.(Math.round(((i + 1) / ranges.length) * 100))
    }

    return results
  }, [files])

  const rotatePages = useCallback(async (
    fileId: string,
    rangeStr: string,
    angle: number,
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    validatePdfHeader(file.data)

    const pdfDoc = await PDFDocument.load(file.data)
    const maxPages = pdfDoc.getPageCount()
    const pages = getPageRange(rangeStr, maxPages)

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_rotated.pdf`,
    })

    if (result.canceled || !result.filePath) return null

    for (let i = 0; i < pages.length; i++) {
      token?.throwIfCancelled()
      const page = pdfDoc.getPage(pages[i])
      const currentRotation = page.getRotation().angle
      page.setRotation(degrees(currentRotation + angle))
      onProgress?.(Math.round(((i + 1) / pages.length) * 100))
    }

    token?.throwIfCancelled()
    const bytes = await pdfDoc.save()
    const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  const deletePages = useCallback(async (
    fileId: string,
    rangeStr: string,
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    validatePdfHeader(file.data)

    const pdfDoc = await PDFDocument.load(file.data)
    const maxPages = pdfDoc.getPageCount()
    const pagesToDelete = new Set(getPageRange(rangeStr, maxPages))

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_deleted.pdf`,
    })

    if (result.canceled || !result.filePath) return null

    const newPdf = await PDFDocument.create()
    const pagesToKeep = Array.from({ length: maxPages }, (_, i) => i)
      .filter(i => !pagesToDelete.has(i))

    const copiedPages = await newPdf.copyPages(pdfDoc, pagesToKeep)
    copiedPages.forEach((page, i) => {
      newPdf.addPage(page)
      onProgress?.(Math.round(((i + 1) / copiedPages.length) * 100))
    })

    token?.throwIfCancelled()
    const bytes = await newPdf.save()
    const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  const extractPages = useCallback(async (
    fileId: string,
    rangeStr: string,
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    validatePdfHeader(file.data)

    const pdfDoc = await PDFDocument.load(file.data)
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
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  return { splitFile, rotatePages, deletePages, extractPages }
}
