import { useState, useCallback } from 'react'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { getPageRange } from '@/lib/utils'
import { toast } from 'sonner'
import { getPdfjsLib } from '@/lib/pdfjs-config'
import { logger } from '@/lib/logger'
import { CancellationToken } from '@/lib/cancellation'
import { clearThumbnailCacheForFile } from '@/components/PageThumbnail'
import { hexToRgb, estimateTextWidth, yieldToMain, checkResult } from '@/lib/pdf-helpers'
import {
  MAX_FILE_SIZE,
  MAX_FILE_COUNT,
  MAX_TOTAL_SIZE,
  DEFAULT_WATERMARK_OPACITY,
  DEFAULT_WATERMARK_FONT_SIZE,
  DEFAULT_WATERMARK_ROTATE,
  DEFAULT_WATERMARK_GAP,
  DEFAULT_WATERMARK_IMAGE_GAP,
  DEFAULT_PAGE_NUMBER_FONT_SIZE,
  DEFAULT_PAGE_NUMBER_START,
  DEFAULT_PAGE_NUMBER_MARGIN,
  DEFAULT_PAGE_NUMBER_TEXT_MARGIN,
  PDF_TO_IMAGE_SCALE,
  JPG_QUALITY,
  COMPRESSION_OBJECTS_PER_TICK,
} from '@/lib/constants'

interface TextItem {
  str: string
}

interface TextContent {
  items: TextItem[]
}

export interface PDFFile {
  id: string
  name: string
  size: number
  pageCount: number
  data: Uint8Array
}

export interface UsePDFReturn {
  files: PDFFile[]
  addFiles: (fileList: File[]) => Promise<void>
  removeFile: (id: string) => void
  reorderFiles: (fromIndex: number, toIndex: number) => void
  mergeFiles: (onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  splitFile: (fileId: string, rangeStr: string, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string[] | null>
  rotatePages: (fileId: string, rangeStr: string, angle: number, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  deletePages: (fileId: string, rangeStr: string, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  extractPages: (fileId: string, rangeStr: string, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  compressFile: (fileId: string, level: 'high' | 'medium' | 'low', onProgress?: (progress: number) => void, token?: CancellationToken, options?: { preserveMetadata?: boolean }) => Promise<string | null>
  addWatermark: (fileId: string, options: {
    type: 'text' | 'image'
    content?: string
    imagePath?: string
    position?: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'tile'
    opacity?: number
    fontSize?: number
    rotate?: number
    color?: string
  }, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  addPageNumbers: (fileId: string, options: {
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
    startNumber?: number
    fontSize?: number
    color?: string
    format?: 'simple' | 'ofTotal' | 'custom'
    prefix?: string
  }, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  convertToImages: (fileId: string, format: 'png' | 'jpg', onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  convertToText: (fileId: string, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  imagesToPdf: (imagePaths: string[], options?: { pageSize?: 'auto' | 'A4' }, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  getPageThumbnail: (fileId: string, pageIndex: number, maxWidth?: number) => Promise<string | null>
  addSignature: (fileId: string, signatureDataUrl: string, options: { pageIndex: number; x: number; y: number; width: number; height: number }, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  addAnnotation: (fileId: string, annotations: Array<{ pageIndex: number; type: 'text' | 'rect' | 'highlight' | 'circle'; x: number; y: number; width?: number; height?: number; text?: string; color?: string; opacity?: number; fontSize?: number }>, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  ocrPDF: (fileId: string, language: string, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  pdfToWord: (fileId: string, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
  wordToPdf: (filePath: string, onProgress?: (progress: number) => void, token?: CancellationToken) => Promise<string | null>
}

import type { FileResult } from '@/lib/pdf-helpers'

declare global {
  interface Window {
    electronAPI: {
      openFile: (options?: object) => Promise<{ canceled: boolean; filePaths: string[] }>
      saveFile: (options?: object) => Promise<{ canceled: boolean; filePath: string }>
      readFile: (filePath: string) => Promise<Uint8Array | FileResult>
      writeFile: (filePath: string, buffer: Uint8Array) => Promise<boolean | FileResult>
      fileExists: (filePath: string) => Promise<boolean>
      fileStat: (filePath: string) => Promise<{ size: number; isFile: boolean; isDirectory: boolean }>
      convertWordToPdf: (filePath: string) => Promise<{ data?: Uint8Array; error?: string }>
    }
  }
}

export function usePDF(): UsePDFReturn {
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
        // 提前校验PDF头
        const header = new TextDecoder().decode(data.slice(0, 5))
        if (header !== '%PDF-') {
          toast.error(`${file.name} 不是有效的PDF文档`)
          continue
        }
        const pdfDoc = await PDFDocument.load(data)
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
      const existingTotalSize = prev.reduce((sum, f) => sum + f.size, 0)
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
        return true
      })
      return [...prev, ...uniqueNew]
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

  const mergeFiles = useCallback(async (onProgress?: (progress: number) => void, token?: CancellationToken) => {
    if (files.length < 2) return null

    const result = await window.electronAPI.saveFile({
      defaultPath: 'merged.pdf',
    })

    if (result.canceled || !result.filePath) return null

    const mergedPdf = await PDFDocument.create()

    for (let i = 0; i < files.length; i++) {
      token?.throwIfCancelled()
      const file = files[i]
      const pdfDoc = await PDFDocument.load(file.data)
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
      copiedPages.forEach(page => mergedPdf.addPage(page))

      onProgress?.(Math.round(((i + 1) / files.length) * 100))
    }

    token?.throwIfCancelled()
    const mergedBytes = await mergedPdf.save()
    const writeResult = await window.electronAPI.writeFile(result.filePath, mergedBytes)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  const splitFile = useCallback(async (
    fileId: string,
    rangeStr: string,
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    // 校验PDF有效性
    const header = new TextDecoder().decode(file.data.slice(0, 5))
    if (header !== '%PDF-') throw new Error('不是有效的PDF文档')
    
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
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

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
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

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
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

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

  const compressFile = useCallback(async (
    fileId: string,
    level: 'high' | 'medium' | 'low',
    onProgress?: (progress: number) => void,
    token?: CancellationToken,
    options?: { preserveMetadata?: boolean }
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

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

  const addWatermark = useCallback(async (
    fileId: string,
    options: {
      type: 'text' | 'image'
      content?: string
      imagePath?: string
      position?: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'tile'
      opacity?: number
      fontSize?: number
      rotate?: number
      color?: string
    },
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

    const pdfDoc = await PDFDocument.load(file.data)
    const pages = pdfDoc.getPages()
    const {
      type,
      content = '水印',
      position = 'center',
      opacity = DEFAULT_WATERMARK_OPACITY,
      fontSize = DEFAULT_WATERMARK_FONT_SIZE,
      rotate = DEFAULT_WATERMARK_ROTATE,
      color = '#999999'
    } = options

    let embeddedImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null
    if (type === 'image' && options.imagePath) {
      const imageBuffer = await window.electronAPI.readFile(options.imagePath)
      checkResult(imageBuffer, '读取水印图片失败')
      try {
        embeddedImage = await pdfDoc.embedPng(imageBuffer as Uint8Array)
      } catch {
        try {
          embeddedImage = await pdfDoc.embedJpg(imageBuffer as Uint8Array)
        } catch {
          throw new Error('不支持的图片格式，请使用 PNG 或 JPG 格式')
        }
      }
    }

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`,
    })

    if (result.canceled || !result.filePath) return null

    for (let i = 0; i < pages.length; i++) {
      token?.throwIfCancelled()
      const page = pages[i]
      const { width, height } = page.getSize()

      if (type === 'text') {
        const textWidth = estimateTextWidth(content, fontSize)

        const getPosition = () => {
          switch (position) {
            case 'top-left': return { x: 50, y: height - 50 - fontSize }
            case 'top-center': return { x: width / 2 - textWidth / 2, y: height - 50 - fontSize }
            case 'top-right': return { x: width - 50 - textWidth, y: height - 50 - fontSize }
            case 'center': return { x: width / 2 - textWidth / 2, y: height / 2 - fontSize / 2 }
            case 'bottom-left': return { x: 50, y: 50 }
            case 'bottom-center': return { x: width / 2 - textWidth / 2, y: 50 }
            case 'bottom-right': return { x: width - 50 - textWidth, y: 50 }
            default: return { x: width / 2 - textWidth / 2, y: height / 2 - fontSize / 2 }
          }
        }

        if (position === 'tile') {
          let count = 0
          const maxTiles = 500
          for (let x = -width / 2; x < width * 1.5 && count < maxTiles; x += DEFAULT_WATERMARK_GAP) {
            for (let y = -height / 2; y < height * 1.5 && count < maxTiles; y += DEFAULT_WATERMARK_GAP) {
              page.drawText(content, {
                x,
                y,
                size: fontSize,
                color: hexToRgb(color),
                opacity,
                rotate: degrees(rotate),
              })
              count++
            }
          }
        } else {
          const { x, y } = getPosition()
          page.drawText(content, {
            x,
            y,
            size: fontSize,
            color: hexToRgb(color),
            opacity,
            rotate: degrees(rotate),
          })
        }
      } else if (type === 'image' && embeddedImage) {
        const imgWidth = embeddedImage.width / 4
        const imgHeight = embeddedImage.height / 4

        const getPosition = () => {
          switch (position) {
            case 'top-left': return { x: 50, y: height - 50 - imgHeight }
            case 'top-center': return { x: width / 2 - imgWidth / 2, y: height - 50 - imgHeight }
            case 'top-right': return { x: width - 50 - imgWidth, y: height - 50 - imgHeight }
            case 'center': return { x: width / 2 - imgWidth / 2, y: height / 2 - imgHeight / 2 }
            case 'bottom-left': return { x: 50, y: 50 }
            case 'bottom-center': return { x: width / 2 - imgWidth / 2, y: 50 }
            case 'bottom-right': return { x: width - 50 - imgWidth, y: 50 }
            default: return { x: width / 2 - imgWidth / 2, y: height / 2 - imgHeight / 2 }
          }
        }

        if (position === 'tile') {
          let count = 0
          const maxTiles = 500
          for (let x = -width / 2; x < width * 1.5 && count < maxTiles; x += DEFAULT_WATERMARK_IMAGE_GAP) {
            for (let y = -height / 2; y < height * 1.5 && count < maxTiles; y += DEFAULT_WATERMARK_IMAGE_GAP) {
              page.drawImage(embeddedImage, {
                x,
                y,
                width: imgWidth,
                height: imgHeight,
                opacity,
                rotate: degrees(rotate),
              })
              count++
            }
          }
        } else {
          const { x, y } = getPosition()
          page.drawImage(embeddedImage, {
            x,
            y,
            width: imgWidth,
            height: imgHeight,
            opacity,
            rotate: degrees(rotate),
          })
        }
      }

      onProgress?.(Math.round(((i + 1) / pages.length) * 100))
    }

    const bytes = await pdfDoc.save()
    const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  const addPageNumbers = useCallback(async (
    fileId: string,
    options: {
      position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
      startNumber?: number
      fontSize?: number
      color?: string
      format?: 'simple' | 'ofTotal' | 'custom'
      prefix?: string
    },
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_paged.pdf`,
    })

    if (result.canceled || !result.filePath) return null

    const pdfDoc = await PDFDocument.load(file.data)
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

  const convertToImages = useCallback(async (
    fileId: string,
    format: 'png' | 'jpg',
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_page1.${format}`,
    })
    if (result.canceled || !result.filePath) return null

    const lastSlash = Math.max(result.filePath.lastIndexOf('\\'), result.filePath.lastIndexOf('/'))
    const dir = result.filePath.substring(0, lastSlash)
    const baseName = result.filePath.substring(lastSlash + 1).replace(/\.[^.]+$/, '').replace(/_page\d+$/, '')
    const buffer = file.data

    const pdfjsLib = getPdfjsLib()
    const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise
    const pages = pdfDoc.numPages

    try {
      for (let i = 1; i <= pages; i++) {
        token?.throwIfCancelled()
        await yieldToMain()
        const page = await pdfDoc.getPage(i)
        const viewport = page.getViewport({ scale: PDF_TO_IMAGE_SCALE })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('无法创建 Canvas 上下文')
        }
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport,
        }).promise

        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
        const quality = format === 'jpg' ? JPG_QUALITY : undefined
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b)
            else reject(new Error('Canvas 导出图片失败'))
          }, mimeType, quality)
        })

        const imgBuffer = await blob.arrayBuffer()
        canvas.width = 0
        canvas.height = 0

        const sep = dir.includes('\\') ? '\\' : '/'
        const outputPath = `${dir}${sep}${baseName}_page${i}.${format}`
        checkResult(await window.electronAPI.writeFile(outputPath, new Uint8Array(imgBuffer)), '写入图片失败：')

        onProgress?.(Math.round((i / pages) * 100))
      }
    } finally {
      pdfDoc.destroy()
    }

    const sep = dir.includes('\\') ? '\\' : '/'
    return `${dir}${sep}${baseName}`
  }, [files])

  const convertToText = useCallback(async (
    fileId: string,
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}.txt`,
    })
    if (result.canceled || !result.filePath) return null

    const buffer = file.data

    const pdfjsLib = getPdfjsLib()
    const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise
    const pages = pdfDoc.numPages
    let fullText = ''

    try {
      for (let i = 1; i <= pages; i++) {
        token?.throwIfCancelled()
        await yieldToMain()
        const page = await pdfDoc.getPage(i)
        const textContent = await page.getTextContent() as TextContent
        const pageText = textContent.items
          .map((item) => item.str)
          .join(' ')
        fullText += `=== 第 ${i} 页 ===\n${pageText}\n\n`
        onProgress?.(Math.round((i / pages) * 100))
      }
    } finally {
      pdfDoc.destroy()
    }

    const encoder = new TextEncoder()
    checkResult(await window.electronAPI.writeFile(result.filePath, encoder.encode(fullText)), '写入文件失败：')

    return result.filePath
  }, [files])

  const imagesToPdf = useCallback(async (
    imagePaths: string[],
    options?: { pageSize?: 'auto' | 'A4' },
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    if (imagePaths.length === 0) return null

    const pageSize = options?.pageSize || 'auto'
    const pdfDoc = await PDFDocument.create()

    for (let i = 0; i < imagePaths.length; i++) {
      token?.throwIfCancelled()
      const imageBuffer = await window.electronAPI.readFile(imagePaths[i])
      checkResult(imageBuffer, '读取图片失败：')

      let image
      try {
        image = await pdfDoc.embedPng(imageBuffer as Uint8Array)
      } catch {
        try {
          image = await pdfDoc.embedJpg(imageBuffer as Uint8Array)
        } catch {
          throw new Error(`不支持的图片格式：${imagePaths[i]}`)
        }
      }

      let pageWidth: number
      let pageHeight: number

      if (pageSize === 'A4') {
        pageWidth = 595.28
        pageHeight = 841.89
      } else {
        pageWidth = image.width
        pageHeight = image.height
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight])

      if (pageSize === 'A4') {
        const margin = 40
        const maxWidth = pageWidth - margin * 2
        const maxHeight = pageHeight - margin * 2
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
        const scaledWidth = image.width * scale
        const scaledHeight = image.height * scale
        const x = (pageWidth - scaledWidth) / 2
        const y = (pageHeight - scaledHeight) / 2
        page.drawImage(image, { x, y, width: scaledWidth, height: scaledHeight })
      } else {
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
      }

      onProgress?.(Math.round(((i + 1) / imagePaths.length) * 80))
    }

    const result = await window.electronAPI.saveFile({
      defaultPath: 'images.pdf',
    })

    if (result.canceled || !result.filePath) return null

    onProgress?.(90)
    const bytes = await pdfDoc.save()
    onProgress?.(95)

    const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
    checkResult(writeResult, '写入文件失败：')

    onProgress?.(100)
    return result.filePath
  }, [])

  const getPageThumbnail = useCallback(async (
    fileId: string,
    pageIndex: number,
    maxWidth: number = 150
  ): Promise<string | null> => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

    try {
      const pdfjsLib = getPdfjsLib()
      const pdf = await pdfjsLib.getDocument({ data: file.data }).promise
      try {
        const page = await pdf.getPage(pageIndex + 1)

        const viewport = page.getViewport({ scale: 1 })
        const scale = maxWidth / viewport.width
        const scaledViewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height

        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
        return canvas.toDataURL('image/png')
      } finally {
        pdf.destroy()
      }
    } catch {
      return null
    }
  }, [files])

  const addSignature = useCallback(async (
    fileId: string,
    signatureDataUrl: string,
    options: { pageIndex: number; x: number; y: number; width: number; height: number },
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) throw new Error('文件不存在')
    // 校验是否为有效PDF
    const header = new TextDecoder().decode(file.data.slice(0, 5))
    if (header !== '%PDF-') throw new Error('不是有效的PDF文档，请检查文件是否损坏')
    
    // 校验pageIndex是否在有效范围内
    if (options.pageIndex < 0 || options.pageIndex >= file.pageCount) {
      throw new Error('页码超出范围，请选择有效的页码')
    }
    
    // 简单的PDF内容安全校验，检查是否包含嵌入式JavaScript
    const pdfContent = new TextDecoder().decode(file.data.slice(0, 1024 * 1024)) // 检查前1MB内容
    if (pdfContent.includes('/JavaScript') || pdfContent.includes('/JS')) {
      throw new Error('PDF包含嵌入式JavaScript，为了安全起见，禁止对此文件进行签名')
    }

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_signed.pdf`,
    })
    if (result.canceled || !result.filePath) return null

    token?.throwIfCancelled()
    onProgress?.(20)

    const pdfDoc = await PDFDocument.load(file.data)
    const base64 = signatureDataUrl.split(',')[1]
    let imgBytes: Uint8Array
    try {
      imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    } catch (e) {
      throw new Error('签名图片格式错误，请重新选择或绘制签名')
    }
    let signatureImage
    try {
      signatureImage = await pdfDoc.embedPng(imgBytes)
    } catch {
      try {
        signatureImage = await pdfDoc.embedJpg(imgBytes)
      } catch {
        throw new Error('不支持的签名图片格式，请使用 PNG 或 JPG 格式')
      }
    }

    token?.throwIfCancelled()
    onProgress?.(50)

    const page = pdfDoc.getPage(options.pageIndex)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()
    // 二次校验签名位置边界
    if (options.x < 0 || options.y < 0 ||
        options.x + options.width > pageWidth ||
        options.y + options.height > pageHeight) {
      throw new Error('签名超出页面范围，请调整位置或缩小签名尺寸')
    }
    page.drawImage(signatureImage, {
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
    })

    onProgress?.(80)
    const bytes = await pdfDoc.save()
    
    // 校验文件路径安全性，防止路径遍历攻击
    const filePath = result.filePath
    // 校验路径是否包含非法字符和路径遍历符号
    if (filePath.includes('..') || filePath.includes('%2e%2e') || 
        !filePath.endsWith('.pdf') || filePath.length > 260) {
      throw new Error('文件路径不合法，请选择有效的保存路径')
    }
    
    const writeResult = await window.electronAPI.writeFile(filePath, bytes)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  const addAnnotation = useCallback(async (
    fileId: string,
    annotations: Array<{
      pageIndex: number
      type: 'text' | 'rect' | 'highlight' | 'circle'
      x: number; y: number
      width?: number; height?: number
      text?: string; color?: string; opacity?: number; fontSize?: number
    }>,
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) throw new Error('文件不存在')

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_edited.pdf`,
    })
    if (result.canceled || !result.filePath) return null

    token?.throwIfCancelled()
    onProgress?.(10)

    const pdfDoc = await PDFDocument.load(file.data)

    for (let i = 0; i < annotations.length; i++) {
      token?.throwIfCancelled()
      const ann = annotations[i]
      const page = pdfDoc.getPage(ann.pageIndex)
      const color = hexToRgb(ann.color || '#000000')
      const opacity = ann.opacity ?? 1

      switch (ann.type) {
        case 'text':
          page.drawText(ann.text || '', {
            x: ann.x, y: ann.y,
            size: ann.fontSize || 16,
            color,
            opacity,
          })
          break
        case 'rect':
          page.drawRectangle({
            x: ann.x, y: ann.y,
            width: ann.width || 100, height: ann.height || 50,
            borderColor: color,
            borderWidth: 1,
            opacity,
          })
          break
        case 'highlight':
          page.drawRectangle({
            x: ann.x, y: ann.y,
            width: ann.width || 100, height: ann.height || 20,
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
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  const ocrPDF = useCallback(async (
    fileId: string,
    language: string = 'chi_sim+eng',
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) throw new Error('文件不存在')

    const pdfjsLib = getPdfjsLib()
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(file.data) }).promise
    const totalPages = pdfDoc.numPages

    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker(language, 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          const pageProgress = Math.round(((currentPage - 1 + m.progress) / totalPages) * 100)
          onProgress?.(pageProgress)
        }
      }
    })

    let fullText = ''
    let currentPage = 0

    try {
      for (let i = 1; i <= totalPages; i++) {
        token?.throwIfCancelled()
        currentPage = i
        const page = await pdfDoc.getPage(i)
        const viewport = page.getViewport({ scale: 2.0 })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('无法创建 Canvas 上下文')

        await page.render({ canvasContext: ctx, viewport }).promise

        const { data: { text } } = await worker.recognize(canvas)
        fullText += (i > 1 ? '\n' : '') + `--- 第${i}页 ---\n${text}\n`

        canvas.width = 0
        canvas.height = 0
      }
    } finally {
      await worker.terminate()
      pdfDoc.destroy()
    }

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_ocr.txt`,
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    })

    if (result.canceled || !result.filePath) return null

    const encoder = new TextEncoder()
    const writeResult = await window.electronAPI.writeFile(result.filePath, encoder.encode(fullText))
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  const pdfToWord = useCallback(async (
    fileId: string,
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) throw new Error('文件不存在')

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}.docx`,
      filters: [{ name: 'Word文档', extensions: ['docx'] }],
    })
    if (result.canceled || !result.filePath) return null

    token?.throwIfCancelled()
    onProgress?.(10)

    const pdfjsLib = getPdfjsLib()
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(file.data) }).promise
    const totalPages = pdfDoc.numPages

    const { Document, Packer, Paragraph, TextRun, PageBreak } = await import('docx')
    const paragraphs: InstanceType<typeof Paragraph>[] = []

    try {
      for (let i = 1; i <= totalPages; i++) {
        token?.throwIfCancelled()
        const page = await pdfDoc.getPage(i)
        const textContent = await page.getTextContent()
        const items = textContent.items as Array<{ str: string; transform?: number[] }>

        let currentLine = ''
        let lastY: number | null = null

        for (const item of items) {
          if (!item.str) continue
          const y = item.transform ? item.transform[5] : null

          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
            if (currentLine.trim()) {
              paragraphs.push(new Paragraph({ children: [new TextRun(currentLine.trim())] }))
            }
            currentLine = item.str
          } else {
            currentLine += item.str
          }
          lastY = y
        }

        if (currentLine.trim()) {
          paragraphs.push(new Paragraph({ children: [new TextRun(currentLine.trim())] }))
        }

        if (i < totalPages) {
          paragraphs.push(new Paragraph({ children: [new PageBreak()] }))
        }

        onProgress?.(Math.round((i / totalPages) * 80))
      }
    } finally {
      pdfDoc.destroy()
    }

    token?.throwIfCancelled()

    const doc = new Document({
      sections: [{ children: paragraphs }],
    })

    onProgress?.(90)
    const buffer = await Packer.toBuffer(doc)
    const uint8 = new Uint8Array(buffer)

    const writeResult = await window.electronAPI.writeFile(result.filePath, uint8)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  const wordToPdf = useCallback(async (
    filePath: string,
    onProgress?: (progress: number) => void,
    token?: CancellationToken
  ) => {
    token?.throwIfCancelled()
    onProgress?.(10)
    const exists = await window.electronAPI.fileExists(filePath)
    if (!exists) throw new Error('文件不存在')

    token?.throwIfCancelled()
    onProgress?.(30)
    const pdfResult = await window.electronAPI.convertWordToPdf(filePath)
    if (pdfResult.error) throw new Error(pdfResult.error)
    if (!pdfResult.data) throw new Error('转换结果为空')

    token?.throwIfCancelled()
    onProgress?.(80)

    const saveResult = await window.electronAPI.saveFile({
      defaultPath: filePath.replace(/\.(docx?|xlsx?|pptx?)$/i, '.pdf'),
      filters: [{ name: 'PDF文件', extensions: ['pdf'] }],
    })
    if (saveResult.canceled || !saveResult.filePath) return null

    token?.throwIfCancelled()
    const moveResult = await window.electronAPI.writeFile(saveResult.filePath, pdfResult.data)
    checkResult(moveResult, '写入文件失败：')

    onProgress?.(100)
    return saveResult.filePath
  }, [])

  return {
    files,
    addFiles,
    removeFile,
    reorderFiles,
    mergeFiles,
    splitFile,
    rotatePages,
    deletePages,
    extractPages,
    compressFile,
    addWatermark,
    addPageNumbers,
    convertToImages,
    convertToText,
    imagesToPdf,
    getPageThumbnail,
    addSignature,
    addAnnotation,
    ocrPDF,
    pdfToWord,
    wordToPdf,
  }
}
