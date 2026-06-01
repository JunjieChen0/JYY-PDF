import { useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { PDFFile, ProgressCallback } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader } from '@/lib/pdf-helpers'
import { logger } from '@/lib/logger'

export function usePDFSignature(files: PDFFile[]) {
  const addSignature = useCallback(async (
    fileId: string,
    signatureDataUrl: string,
    options: { pageIndex: number; x: number; y: number; width: number; height: number },
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) throw new Error('文件不存在')
    validatePdfHeader(file.data)

    if (options.pageIndex < 0 || options.pageIndex >= file.pageCount) {
      throw new Error('页码超出范围，请选择有效的页码')
    }

    const checkChunkSize = 4 * 1024 * 1024
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let jsDetected = false
    for (let offset = 0; offset < file.data.length; offset += checkChunkSize) {
      const chunk = decoder.decode(file.data.slice(offset, offset + checkChunkSize), { stream: true })
      if (/\/JavaScript\s*[[\]/]>]/i.test(chunk) || /\/JS\s*[[\]/]>]/i.test(chunk) || /\/S\s*\/JavaScript/i.test(chunk)) {
        jsDetected = true
        break
      }
    }
    if (jsDetected) {
      logger.warn('PDF包含嵌入式JavaScript（可能是表单验证等合法功能），继续签名')
    }

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_signed.pdf`,
    })
    if (result.canceled || !result.filePath) return null

    token?.throwIfCancelled()
    onProgress?.(20)

    const pdfDoc = await PDFDocument.load(file.data, { ignoreEncryption: true })
    const base64 = signatureDataUrl.split(',')[1]
    let imgBytes: Uint8Array
    try {
      imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    } catch {
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

    const filePath = result.filePath
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
    if (normalizedPath.includes('..') || normalizedPath.length > 260) {
      throw new Error('文件路径不合法，请选择有效的保存路径')
    }
    if (!normalizedPath.endsWith('.pdf')) {
      throw new Error('请选择 PDF 文件格式保存')
    }

    const writeResult = await window.electronAPI.writeFile(filePath, bytes)
    checkResult(writeResult, '写入文件失败：')

    return result.filePath
  }, [files])

  return { addSignature }
}
