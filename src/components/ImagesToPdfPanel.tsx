import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ImageIcon, Loader2, Upload, X, GripVertical, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOperation } from '@/hooks/useOperation'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface ImageItem {
  path: string
  name: string
}

interface ImagesToPdfPanelProps {
  pdf: UsePDFReturn
}

export function ImagesToPdfPanel({ pdf }: ImagesToPdfPanelProps) {
  const { t } = useTranslation()
  const [images, setImages] = useState<ImageItem[]>([])
  const [pageSize, setPageSize] = useState<'auto' | 'A4'>('auto')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.convert'),
    onCancelMessage: t('errorPrefix.cancelled'),
  })
  const rafRef = useRef<number | null>(null)
  const pendingDropIndex = useRef<number | null>(null)

  const handleSelectImages = async () => {
    const result = await window.electronAPI.openFile({
      defaultPath: '',
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const newImages: ImageItem[] = []
      for (const filePath of result.filePaths) {
        const ext = filePath.toLowerCase().split('.').pop()
        if (!['png', 'jpg', 'jpeg'].includes(ext || '')) {
          toast.warning(t('panel.imagesToPdf.skipNonImage', { name: filePath.split(/[/\\]/).pop() }))
          continue
        }
        const parts = filePath.replace(/\\/g, '/').split('/')
        newImages.push({
          path: filePath,
          name: parts[parts.length - 1],
        })
      }
      if (newImages.length > 0) {
        setImages((prev) => [...prev, ...newImages])
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return

    pendingDropIndex.current = index
    if (rafRef.current !== null) return

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const targetIndex = pendingDropIndex.current
      if (targetIndex === null || dragIndex === null || dragIndex === targetIndex) return

      setImages((prev) => {
        const newImages = [...prev]
        const [removed] = newImages.splice(dragIndex, 1)
        newImages.splice(targetIndex, 0, removed)
        return newImages
      })
      setDragIndex(targetIndex)
      pendingDropIndex.current = null
    })
  }

  const handleDragEnd = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    pendingDropIndex.current = null
    setDragIndex(null)
  }

  const handleConvert = async () => {
    if (images.length === 0) return

    const result = await execute(async (onProgress, token) => {
      const imagePaths = images.map((img) => img.path)
      return pdf.imagesToPdf(imagePaths, { pageSize }, onProgress, token)
    })
    // 注：imagesToPdf 操作的源是图片路径而非 PDF 文件 ID，不参与文件互斥锁
    void undefined

    if (result) {
      toast.success(t('panel.imagesToPdf.convertCompleted', { path: result }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          {t('panel.imagesToPdf.title')}
        </CardTitle>
        <CardDescription>{t('panel.imagesToPdf.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t('panel.imagesToPdf.imageList')}</label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectImages}
              disabled={isProcessing}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('panel.imagesToPdf.selectImages')}
            </Button>
          </div>

          {images.length === 0 ? (
            <div
              onClick={handleSelectImages}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t('panel.imagesToPdf.clickToSelect')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('panel.imagesToPdf.dragHint')}</p>
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {images.map((img, index) => (
                <div
                  key={`${img.path}-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-move hover:bg-muted/50 transition-colors ${
                    dragIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground text-xs w-6">{index + 1}</span>
                  <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{img.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => handleRemoveImage(index)}
                    disabled={isProcessing}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {images.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">{t('panel.imagesToPdf.imageCount', { count: images.length })}</p>
          )}
        </div>

        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{t('panel.imagesToPdf.pageSize')}</Label>
              <Select value={pageSize} onValueChange={(v) => setPageSize(v as 'auto' | 'A4')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t('panel.imagesToPdf.pageSizeAuto')}</SelectItem>
                  <SelectItem value="A4">{t('panel.imagesToPdf.pageSizeA4')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {pageSize === 'auto'
                  ? t('panel.imagesToPdf.pageSizeAutoHint')
                  : t('panel.imagesToPdf.pageSizeA4Hint')}
              </p>
            </div>

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">{t('panel.imagesToPdf.converting', { progress })}</p>
              </motion.div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleConvert} disabled={isProcessing} className="flex-1">
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('panel.imagesToPdf.convertingBtn')}
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {t('panel.imagesToPdf.generatePdf')}
                  </>
                )}
              </Button>
              {isProcessing && (
                <Button variant="outline" onClick={cancel}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('panel.imagesToPdf.cancel')}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
