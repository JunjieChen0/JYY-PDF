import { useCallback } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PDFFile, ProgressCallback, Annotation } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { hexToRgb, checkResult, validatePdfHeader } from '@/lib/pdf-helpers'

export function usePDFAnnotation(files: PDFFile[]) {
  const addAnnotation = useCallback(async (
    fileId: string,
    annotations: Annotation[],
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) throw new Error('文件不存在')
    validatePdfHeader(file.data)

    const result = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_edited.pdf`,
    })
    if (result.canceled || !result.filePath) return null

    token?.throwIfCancelled()
    onProgress?.(10)

    const pdfDoc = await PDFDocument.load(new Uint8Array(file.data), { ignoreEncryption: true })
    pdfDoc.registerFontkit(fontkit)
    const totalPages = pdfDoc.getPageCount()

    const fontBytes = await window.electronAPI.readSystemFont('simsun')
    checkResult(fontBytes, '读取系统字体失败，请确保系统已安装宋体字体')
    const embeddedFont = await pdfDoc.embedFont(fontBytes as Uint8Array, { subset: true })

    for (let i = 0; i < annotations.length; i++) {
      token?.throwIfCancelled()
      const ann = annotations[i]
      if (ann.pageIndex < 0 || ann.pageIndex >= totalPages) {
        throw new Error(`标注页码越界（批注 #${i + 1} 指向第 ${ann.pageIndex + 1} 页，文档共 ${totalPages} 页）`)
      }
      const page = pdfDoc.getPage(ann.pageIndex)
      const color = hexToRgb(ann.color || '#000000')
      const opacity = ann.opacity ?? 1

      switch (ann.type) {
        case 'text':
          page.drawText(ann.text || '', {
            x: ann.x, y: ann.y,
            size: ann.fontSize || 16,
            font: embeddedFont,
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

  return { addAnnotation }
}
