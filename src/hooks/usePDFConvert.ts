import { useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import { getPdfjsLib, PDFJS_CONFIG } from '@/lib/pdfjs-config'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { yieldToMain, checkResult } from '@/lib/pdf-helpers'
import { PDF_TO_IMAGE_SCALE, JPG_QUALITY } from '@/lib/constants'
import { splitFilePath, buildOutputPath } from '@/lib/utils'

interface TextItem {
  str: string
}

interface TextContent {
  items: TextItem[]
}

export function usePDFConvert(files: PDFFile[]) {
  const convertToImages = useCallback(async (
    fileId: string,
    format: 'png' | 'jpg',
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_page1.${format}`,
    })
    if (result.canceled || !result.filePath) return null

    const { dir, baseName, sep } = splitFilePath(result.filePath)
    const pdfjsLib = getPdfjsLib()
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(file.data), ...PDFJS_CONFIG }).promise
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

        try {
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

          const outputPath = buildOutputPath(dir, baseName, `_page${i}`, format, sep)
          checkResult(await window.electronAPI.writeFile(outputPath, new Uint8Array(imgBuffer)), '写入图片失败：')

          onProgress?.(Math.round((i / pages) * 100))
        } finally {
          canvas.width = 0
          canvas.height = 0
        }
      }
    } finally {
      pdfDoc.destroy()
    }

    return `${dir}${sep}${baseName}`
  }, [files])

  const convertToText = useCallback(async (
    fileId: string,
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}.txt`,
    })
    if (result.canceled || !result.filePath) return null

    const pdfjsLib = getPdfjsLib()
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(file.data), ...PDFJS_CONFIG }).promise
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
    onProgress?: ProgressCallback,
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

  const pdfToWord = useCallback(async (
    fileId: string,
    onProgress?: ProgressCallback,
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
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(file.data), ...PDFJS_CONFIG }).promise
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
    onProgress?: ProgressCallback,
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

  return { convertToImages, convertToText, imagesToPdf, pdfToWord, wordToPdf }
}
