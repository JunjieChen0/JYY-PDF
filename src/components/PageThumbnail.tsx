import { useState, useEffect, useRef } from 'react'
import { FileText, Loader2 } from 'lucide-react'

const MAX_THUMBNAIL_CACHE = 50
const thumbnailCache = new Map<string, string>()

function setCache(key: string, value: string) {
  if (thumbnailCache.size >= MAX_THUMBNAIL_CACHE) {
    const firstKey = thumbnailCache.keys().next().value
    if (firstKey !== undefined) thumbnailCache.delete(firstKey)
  }
  thumbnailCache.set(key, value)
}

interface PageThumbnailProps {
  fileId: string
  pageIndex?: number
  maxWidth?: number
  className?: string
  getThumbnail: (fileId: string, pageIndex: number, maxWidth?: number) => Promise<string | null>
}

export function PageThumbnail({
  fileId,
  pageIndex = 0,
  maxWidth = 48,
  className = '',
  getThumbnail,
}: PageThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const cacheKey = `${fileId}_${pageIndex}_${maxWidth}`

    const cached = thumbnailCache.get(cacheKey)
    if (cached) {
      setSrc(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    getThumbnail(fileId, pageIndex, maxWidth).then(dataUrl => {
      if (!mountedRef.current) return
      if (dataUrl) {
        setCache(cacheKey, dataUrl)
        setSrc(dataUrl)
      }
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setLoading(false)
    })

    return () => {
      mountedRef.current = false
    }
  }, [fileId, pageIndex, maxWidth, getThumbnail])

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded ${className}`}
        style={{ width: maxWidth, height: maxWidth * 1.414 }}
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded ${className}`}
        style={{ width: maxWidth, height: maxWidth * 1.414 }}
      >
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt="PDF 预览"
      className={`rounded object-cover ${className}`}
      style={{ width: maxWidth, height: maxWidth * 1.414 }}
    />
  )
}

export function clearThumbnailCache() {
  thumbnailCache.clear()
}

export function clearThumbnailCacheForFile(fileId: string) {
  for (const key of thumbnailCache.keys()) {
    if (key.startsWith(`${fileId}_`)) {
      thumbnailCache.delete(key)
    }
  }
}
