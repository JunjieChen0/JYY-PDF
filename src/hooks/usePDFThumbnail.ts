import { useCallback, useEffect, useRef } from 'react'
import { getPdfjsLib, PDFJS_CONFIG } from '@/lib/pdfjs-config'
import type { PDFFile } from './types'
import * as pdfDataStore from '@/lib/pdf-data-store'
import { getRequiredPdfData } from '@/lib/pdf-helpers'

/**
 * 缩略图渲染优化：
 * - 同 fileId 的 pdfjs Document 只解析一次，多页/多次请求共享。
 * - dataURL 缓存按 (fileId, pageIndex, maxWidth) 维度。
 * - 组件卸载 / 文件列表变更时主动 destroy 已缓存的 Document。
 */

interface DocCacheEntry {
  promise: Promise<unknown>
  doc: unknown
}

const MAX_DOC_CACHE_SIZE = 10
const MAX_DATA_URL_CACHE_SIZE = 200

export function usePDFThumbnail(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const docCacheRef = useRef<Map<string, DocCacheEntry>>(new Map())
  const dataUrlCacheRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const validIds = new Set(files.map((f) => f.id))
    const docCache = docCacheRef.current
    for (const [id, entry] of docCache) {
      if (!validIds.has(id)) {
        const doc = entry.doc as { destroy?: () => void } | null
        try {
          doc?.destroy?.()
        } catch {
          /* noop */
        }
        docCache.delete(id)
      }
    }
    for (const key of dataUrlCacheRef.current.keys()) {
      const fileId = key.split('|')[0]
      if (!validIds.has(fileId)) {
        dataUrlCacheRef.current.delete(key)
      }
    }
  }, [files])

  useEffect(() => {
    const docCache = docCacheRef.current
    const dataUrlCache = dataUrlCacheRef.current
    return () => {
      for (const entry of docCache.values()) {
        const doc = entry.doc as { destroy?: () => void } | null
        try {
          doc?.destroy?.()
        } catch {
          /* noop */
        }
      }
      docCache.clear()
      dataUrlCache.clear()
    }
  }, [])

  const getPageThumbnail = useCallback(
    async (fileId: string, pageIndex: number, maxWidth: number = 150): Promise<string | null> => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) return null

      const cacheKey = `${fileId}|${pageIndex}|${maxWidth}`
      const cached = dataUrlCacheRef.current.get(cacheKey)
      if (cached) return cached

      try {
        const pdfjsLib = getPdfjsLib()
        const docCache = docCacheRef.current
        let entry = docCache.get(fileId)
        if (!entry) {
          // 淘汰最旧的文档缓存
          while (docCache.size >= MAX_DOC_CACHE_SIZE) {
            const firstKey = docCache.keys().next().value
            if (firstKey !== undefined) {
              const oldEntry = docCache.get(firstKey)
              if (oldEntry) {
                const doc = oldEntry.doc as { destroy?: () => void } | null
                try {
                  doc?.destroy?.()
                } catch {
                  /* noop */
                }
              }
              docCache.delete(firstKey)
            }
          }

          const fileData = getRequiredPdfData(file.id, pdfDataStore)
          const promise = pdfjsLib.getDocument({
            data: new Uint8Array(fileData),
            ...PDFJS_CONFIG,
          }).promise
          entry = { promise, doc: null }
          docCache.set(fileId, entry)
          promise
            .then((doc) => {
              entry!.doc = doc
            })
            .catch(() => {
              docCache.delete(fileId)
            })
        }
        const pdf = (await entry.promise) as {
          getPage: (n: number) => Promise<unknown>
          destroy: () => void
        }

        const page = await (pdf.getPage(pageIndex + 1) as Promise<{
          getViewport: (opts: { scale: number }) => { width: number; height: number }
          render: (opts: {
            canvasContext: CanvasRenderingContext2D
            viewport: { width: number; height: number }
          }) => { promise: Promise<void> }
        }>)

        const viewport = page.getViewport({ scale: 1 })
        const scale = maxWidth / viewport.width
        const scaledViewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height

        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        try {
          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
          const dataUrl = canvas.toDataURL('image/png')

          // 淘汰最旧的缩略图缓存
          while (dataUrlCacheRef.current.size >= MAX_DATA_URL_CACHE_SIZE) {
            const firstKey = dataUrlCacheRef.current.keys().next().value
            if (firstKey !== undefined) {
              dataUrlCacheRef.current.delete(firstKey)
            }
          }

          dataUrlCacheRef.current.set(cacheKey, dataUrl)
          return dataUrl
        } finally {
          canvas.width = 0
          canvas.height = 0
        }
      } catch {
        return null
      }
    },
    [],
  )

  return { getPageThumbnail }
}
