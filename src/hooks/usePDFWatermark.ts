import { useCallback, useRef } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PDFFile, ProgressCallback, WatermarkPosition } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import {
  hexToRgb,
  estimateTextWidth,
  checkResult,
  validatePdfHeader,
  assertUint8Array,
  getRequiredPdfData,
  yieldToMain,
} from '@/lib/pdf-helpers'
import { t, ErrorCode } from '@/lib/i18n'
import * as pdfDataStore from '@/lib/pdf-data-store'
import { logger } from '@/lib/logger'
import {
  DEFAULT_WATERMARK_OPACITY,
  DEFAULT_WATERMARK_FONT_SIZE,
  DEFAULT_WATERMARK_ROTATE,
  DEFAULT_WATERMARK_GAP,
  DEFAULT_WATERMARK_IMAGE_GAP,
} from '@/lib/constants'

function getPosition(
  position: WatermarkPosition,
  width: number,
  height: number,
  contentWidth: number,
  contentHeight: number,
): { x: number; y: number } {
  switch (position) {
    case 'top-left':
      return { x: 50, y: height - 50 - contentHeight }
    case 'top-center':
      return { x: width / 2 - contentWidth / 2, y: height - 50 - contentHeight }
    case 'top-right':
      return { x: width - 50 - contentWidth, y: height - 50 - contentHeight }
    case 'center':
      return { x: width / 2 - contentWidth / 2, y: height / 2 - contentHeight / 2 }
    case 'bottom-left':
      return { x: 50, y: 50 }
    case 'bottom-center':
      return { x: width / 2 - contentWidth / 2, y: 50 }
    case 'bottom-right':
      return { x: width - 50 - contentWidth, y: 50 }
    default:
      return { x: width / 2 - contentWidth / 2, y: height / 2 - contentHeight / 2 }
  }
}

export function usePDFWatermark(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const addWatermark = useCallback(
    async (
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
      token?: CancellationToken,
    ) => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) return null
      const fileData = getRequiredPdfData(file.id, pdfDataStore)
      validatePdfHeader(fileData)

      let pdfDoc: PDFDocument | null = null
      try {
        pdfDoc = await PDFDocument.load(new Uint8Array(fileData), { ignoreEncryption: true })
        pdfDoc.registerFontkit(fontkit)
        const pages = pdfDoc.getPages()
        const {
          type,
          content = t('panel.watermark.defaultText'),
          position = 'center',
          opacity = DEFAULT_WATERMARK_OPACITY,
          fontSize = DEFAULT_WATERMARK_FONT_SIZE,
          rotate = DEFAULT_WATERMARK_ROTATE,
          color = '#999999',
        } = options

        let embeddedImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null
        let embeddedFont: Awaited<ReturnType<PDFDocument['embedFont']>> | null = null

        if (type === 'image' && options.imagePath) {
          const imageBuffer = await window.electronAPI.readFile(options.imagePath)
          checkResult(imageBuffer, t(ErrorCode.IMAGE_READ_FAILED))
          try {
            embeddedImage = await pdfDoc.embedPng(assertUint8Array(imageBuffer, t(ErrorCode.IMAGE_READ_FAILED)))
          } catch {
            try {
              embeddedImage = await pdfDoc.embedJpg(
                assertUint8Array(imageBuffer, t(ErrorCode.IMAGE_READ_FAILED)),
              )
            } catch {
              throw new Error(t(ErrorCode.UNSUPPORTED_IMAGE_FORMAT))
            }
          }
        }

        if (type === 'text') {
          const fontBytes = await window.electronAPI.readSystemFont('simsun')
          checkResult(fontBytes, t(ErrorCode.SYSTEM_FONT_NOT_INSTALLED))
          embeddedFont = await pdfDoc.embedFont(assertUint8Array(fontBytes, t(ErrorCode.FONT_READ_FAILED)), {
            subset: true,
          })
        }

        const result = await window.electronAPI.saveFile({
          defaultPath: `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`,
        })

        if (result.canceled || !result.filePath) return null

        let tileTruncated = false

        for (let i = 0; i < pages.length; i++) {
          token?.throwIfCancelled()
          await yieldToMain()
          const page = pages[i]
          const { width, height } = page.getSize()

          if (type === 'text' && embeddedFont) {
            const textWidth = estimateTextWidth(content, fontSize)

            if (position === 'tile') {
              let count = 0
              const maxTiles = 500
              for (
                let x = -width / 2;
                x < width * 1.5 && count < maxTiles;
                x += DEFAULT_WATERMARK_GAP
              ) {
                for (
                  let y = -height / 2;
                  y < height * 1.5 && count < maxTiles;
                  y += DEFAULT_WATERMARK_GAP
                ) {
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
              if (count >= maxTiles) tileTruncated = true
            } else {
              const { x, y } = getPosition(position, width, height, textWidth, fontSize)
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

            if (position === 'tile') {
              let count = 0
              const maxTiles = 500
              for (
                let x = -width / 2;
                x < width * 1.5 && count < maxTiles;
                x += DEFAULT_WATERMARK_IMAGE_GAP
              ) {
                for (
                  let y = -height / 2;
                  y < height * 1.5 && count < maxTiles;
                  y += DEFAULT_WATERMARK_IMAGE_GAP
                ) {
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
              if (count >= maxTiles) tileTruncated = true
            } else {
              const { x, y } = getPosition(position, width, height, imgWidth, imgHeight)
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

        if (tileTruncated) {
          logger.warn('Watermark tile limit reached (500/page), some areas may be uncovered')
          throw new Error(t(ErrorCode.WATERMARK_TILE_LIMIT))
        }

        onProgress?.(95)
        const bytes = await pdfDoc.save()
        const writeResult = await window.electronAPI.writeFile(result.filePath, bytes)
        checkResult(writeResult, t(ErrorCode.WRITE_FILE_FAILED))
        onProgress?.(100)

        return result.filePath
      } finally {
        pdfDoc = null
      }
    },
    [],
  )

  return { addWatermark }
}
