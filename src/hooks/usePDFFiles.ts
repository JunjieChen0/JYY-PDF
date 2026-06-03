import { useState, useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { t } from '@/lib/i18n'
import { clearThumbnailCacheForFile } from '@/lib/pdf-data-store'
import {
  MAX_FILE_SIZE,
  MAX_FILE_COUNT,
  MAX_TOTAL_SIZE,
  MEMORY_WARNING_THRESHOLD,
} from '@/lib/constants'
import * as pdfDataStore from '@/lib/pdf-data-store'
import { validatePdfHeader } from '@/lib/pdf-helpers'
import type { PDFFile } from './types'

export type { PDFFile, ProgressCallback } from './types'

export function usePDFFiles() {
  const [files, setFiles] = useState<PDFFile[]>([])
  const filesRef = useRef(files)
  filesRef.current = files

  const addFiles = useCallback(async (fileList: File[]) => {
    const initialTotal = filesRef.current.reduce((sum, f) => sum + f.size, 0)
    let runningTotal = initialTotal
    const candidates: { file: File; data: Uint8Array; pageCount: number; headerHash: string }[] = []

    for (const file of fileList) {
      try {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(t('app.fileTooLarge', { name: file.name }))
          continue
        }
        if (runningTotal + file.size > MAX_TOTAL_SIZE) {
          const limitMB = Math.round(MAX_TOTAL_SIZE / (1024 * 1024))
          toast.warning(t('app.totalSizeExceeded', { name: file.name, limit: limitMB }))
          continue
        }
        if (candidates.length + filesRef.current.length >= MAX_FILE_COUNT) {
          toast.warning(t('app.maxFileCountReached', { name: file.name }))
          continue
        }

        const arrayBuffer = await file.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)
        try {
          validatePdfHeader(data)
        } catch {
          toast.error(t('app.invalidPdfFile', { name: file.name }))
          continue
        }
        let pdfDoc
        try {
          pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true })
        } catch (err) {
          logger.error(`PDF parse failed: ${file.name}`, err)
          toast.error(t('app.fileLoadFailed', { name: file.name }))
          continue
        }
        const pageCount = pdfDoc.getPageCount()
        const headerHash = Array.from(data.slice(0, 1024))
          .reduce((h, b) => ((h << 5) - h + b) | 0, 0)
          .toString(36)

        runningTotal += file.size
        candidates.push({ file, data, pageCount, headerHash })
      } catch (error) {
        logger.error(`Failed to load PDF file: ${file.name}`, error)
        toast.error(t('app.fileLoadFailed', { name: file.name }))
      }
    }

    if (candidates.length === 0) return

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}|${f.size}|${f.headerHash}`))
      const accepted: PDFFile[] = []
      for (const cand of candidates) {
        const key = `${cand.file.name}|${cand.file.size}|${cand.headerHash}`
        if (existingKeys.has(key)) {
          toast.warning(t('app.fileAlreadyExists', { name: cand.file.name }))
          continue
        }
        const id = crypto.randomUUID()
        pdfDataStore.setData(id, cand.data)
        accepted.push({
          id,
          name: cand.file.name,
          size: cand.file.size,
          pageCount: cand.pageCount,
          headerHash: cand.headerHash,
        })
        existingKeys.add(key)
      }
      if (accepted.length === 0) return prev
      const next = [...prev, ...accepted]
      const totalSize = next.reduce((sum, f) => sum + f.size, 0)
      if (totalSize > MEMORY_WARNING_THRESHOLD) {
        const sizeMB = Math.round(totalSize / (1024 * 1024))
        toast.warning(t('app.memoryWarning', { size: sizeMB }))
      }
      return next
    })
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    pdfDataStore.deleteData(id)
    clearThumbnailCacheForFile(id)
  }, [])

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const newFiles = [...prev]
      const [removed] = newFiles.splice(fromIndex, 1)
      newFiles.splice(toIndex, 0, removed)
      return newFiles
    })
  }, [])

  return { files, addFiles, removeFile, reorderFiles }
}
