import { useState, useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { clearThumbnailCacheForFile } from '@/components/PageThumbnail'
import { MAX_FILE_SIZE, MAX_FILE_COUNT, MAX_TOTAL_SIZE, MEMORY_WARNING_THRESHOLD } from '@/lib/constants'
import type { PDFFile } from './types'

export type { PDFFile, ProgressCallback } from './types'

export function usePDFFiles() {
  const [files, setFiles] = useState<PDFFile[]>([])

  const addFiles = useCallback(async (fileList: File[]) => {
    const parsedFiles: PDFFile[] = []

    for (const file of fileList) {
      try {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`文件 ${file.name} 超过最大限制100MB，无法添加`)
          continue
        }

        const arrayBuffer = await file.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)
        const header = new TextDecoder().decode(data.slice(0, 5))
        if (header !== '%PDF-') {
          toast.error(`${file.name} 不是有效的PDF文档`)
          continue
        }
        const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true })
        const pageCount = pdfDoc.getPageCount()

        parsedFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          pageCount,
          data,
        })
      } catch (error) {
        logger.error(`加载PDF文件失败: ${file.name}`, error)
        toast.error(`文件 ${file.name} 加载失败，请检查是否为有效的PDF文件`)
      }
    }

    setFiles(prev => {
      if (prev.length >= MAX_FILE_COUNT) {
        toast.error(`已达到最大文件数量限制（${MAX_FILE_COUNT}个）`)
        return prev
      }

      const existingKeys = new Set(prev.map(f => `${f.name}|${f.size}`))
      let existingTotalSize = prev.reduce((sum, f) => sum + f.size, 0)
      const uniqueNew = parsedFiles.filter(f => {
        if (prev.length + parsedFiles.indexOf(f) >= MAX_FILE_COUNT) {
          toast.warning(`已达到最大文件数量限制，跳过 ${f.name}`)
          return false
        }
        const key = `${f.name}|${f.size}`
        if (existingKeys.has(key)) {
          toast.warning(`文件 ${f.name} 已存在，跳过`)
          return false
        }
        if (existingTotalSize + f.size > MAX_TOTAL_SIZE) {
          toast.warning(`添加 ${f.name} 将超过总大小限制（500MB），跳过`)
          return false
        }
        existingKeys.add(key)
        existingTotalSize += f.size
        return true
      })
      const next = [...prev, ...uniqueNew]
      const totalSize = next.reduce((sum, f) => sum + f.size, 0)
      if (totalSize > MEMORY_WARNING_THRESHOLD) {
        const sizeMB = Math.round(totalSize / (1024 * 1024))
        toast.warning(`当前已加载 ${sizeMB}MB 文件数据，可能影响性能。建议减少文件数量或大小。`)
      }
      return next
    })
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    clearThumbnailCacheForFile(id)
  }, [])

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      const [removed] = newFiles.splice(fromIndex, 1)
      newFiles.splice(toIndex, 0, removed)
      return newFiles
    })
  }, [])

  return { files, addFiles, removeFile, reorderFiles }
}
