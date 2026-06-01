import { useCallback } from 'react'
import { getPdfjsLib } from '@/lib/pdfjs-config'
import type { PDFFile } from './types'

export function usePDFThumbnail(files: PDFFile[]) {
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
        try {
          return canvas.toDataURL('image/png')
        } finally {
          canvas.width = 0
          canvas.height = 0
        }
      } finally {
        pdf.destroy()
      }
    } catch {
      return null
    }
  }, [files])

  return { getPageThumbnail }
}
