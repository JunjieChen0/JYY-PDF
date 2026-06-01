import { useCallback } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PDFFile, ProgressCallback, WatermarkPosition } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { hexToRgb, estimateTextWidth, checkResult, validatePdfHeader } from '@/lib/pdf-helpers'
import {
  DEFAULT_WATERMARK_OPACITY,
  DEFAULT_WATERMARK_FONT_SIZE,
  DEFAULT_WATERMARK_ROTATE,
  DEFAULT_WATERMARK_GAP,
  DEFAULT_WATERMARK_IMAGE_GAP,
} from '@/lib/constants'

export function usePDFWatermark(files: PDFFile[]) {
  const addWatermark = useCallback(async (
    fileId: string,
    options: {
      type: 'text' | 'image'
      content?: string
      imagePath?: string
      position?: WatermarkPosition
      opacity?: number
      fontSize?: number
      rotate?: number
      color?: string
    },
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    validatePdfHeader(file.data)

    const pdfDoc = await PDFDocument.load(new Uint8Array(file.data), { ignoreEncryption: true })
    pdfDoc.registerFontkit(fontkit)
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

    let embeddedFont: Awaited<ReturnType<PDFDocument['embedFont']>> | null = null
    if (type === 'text') {
      const fontBytes = await window.electronAPI.readSystemFont('simsun')
      checkResult(fontBytes, '读取系统字体失败，请确保系统已安装宋体字体')
      embeddedFont = await pdfDoc.embedFont(fontBytes as Uint8Array, { subset: true })
    }

    for (let i = 0; i < pages.length; i++) {
      token?.throwIfCancelled()
      const page = pages[i]
      const { width, height } = page.getSize()

      if (type === 'text' && embeddedFont) {
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
                font: embeddedFont,
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
            font: embeddedFont,
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

  return { addWatermark }
}
