import { useState, useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
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
          toast.error(`文件 ${file.name} 超过最大限制100MB，无法添加`)
          continue
        }
        if (runningTotal + file.size > MAX_TOTAL_SIZE) {
          const limitMB = Math.round(MAX_TOTAL_SIZE / (1024 * 1024))
          toast.warning(`添加 ${file.name} 将超过总大小限制（${limitMB}MB），跳过`)
          continue
        }
        if (candidates.length + filesRef.current.length >= MAX_FILE_COUNT) {
          toast.warning(`已达到最大文件数量限制，跳过 ${file.name}`)
          continue
        }

        const arrayBuffer = await file.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)
        try {
          validatePdfHeader(data)
        } catch {
          toast.error(`${file.name} 不是有效的PDF文档`)
          continue
        }
        let pdfDoc
        try {
          pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true })
        } catch (err) {
          logger.error(`PDF解析失败: ${file.name}`, err)
          toast.error(`文件 ${file.name} 加载失败，请检查是否为有效的PDF文件`)
          continue
        }
        const pageCount = pdfDoc.getPageCount()
        const headerHash = Array.from(data.slice(0, 1024))
          .reduce((h, b) => ((h << 5) - h + b) | 0, 0)
          .toString(36)

        runningTotal += file.size
        candidates.push({ file, data, pageCount, headerHash })
      } catch (error) {
        logger.error(`加载PDF文件失败: ${file.name}`, error)
        toast.error(`文件 ${file.name} 加载失败，请检查是否为有效的PDF文件`)
      }
    }

    if (candidates.length === 0) return

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}|${f.size}|${f.headerHash}`))
      const accepted: PDFFile[] = []
      for (const cand of candidates) {
        const key = `${cand.file.name}|${cand.file.size}|${cand.headerHash}`
        if (existingKeys.has(key)) {
          toast.warning(`文件 ${cand.file.name} 已存在，跳过`)
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
        toast.warning(`当前已加载 ${sizeMB}MB 文件数据，可能影响性能。建议减少文件数量或大小。`)
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
