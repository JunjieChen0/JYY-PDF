import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { ImageIcon, Loader2, Upload, X, GripVertical, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import type { UsePDFReturn } from '@/hooks/usePDF'
import type { CancellationToken } from '@/lib/cancellation'

interface ImageItem {
  path: string
  name: string
}

interface ImagesToPdfPanelProps {
  pdf: UsePDFReturn
}

export function ImagesToPdfPanel({ pdf }: ImagesToPdfPanelProps) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [pageSize, setPageSize] = useState<'auto' | 'A4'>('auto')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [cancelToken, setCancelToken] = useState<CancellationToken | null>(null)
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
          toast.warning(`跳过非图片文件：${filePath.split(/[/\\]/).pop()}`)
          continue
        }
        const parts = filePath.replace(/\\/g, '/').split('/')
        newImages.push({
          path: filePath,
          name: parts[parts.length - 1],
        })
      }
      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages])
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
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

      setImages(prev => {
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

    const token = createCancellationToken()
    setCancelToken(token)
    setIsProcessing(true)
    setProgress(0)

    try {
      const imagePaths = images.map(img => img.path)
      const outputPath = await pdf.imagesToPdf(imagePaths, { pageSize }, p => setProgress(p), token)
      if (outputPath) {
        toast.success(`转换完成！PDF 已保存到：${outputPath}`)
      }
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info('操作已取消')
      } else {
        toast.error(`转换失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setCancelToken(null)
    }
  }

  const handleCancel = () => {
    cancelToken?.cancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          图片转 PDF
        </CardTitle>
        <CardDescription>
          将多张图片合并为一个 PDF 文件
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">图片列表</label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectImages}
              disabled={isProcessing}
            >
              <Upload className="mr-2 h-4 w-4" />
              选择图片
            </Button>
          </div>

          {images.length === 0 ? (
            <div
              onClick={handleSelectImages}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">点击选择 PNG/JPG 图片</p>
              <p className="text-xs text-muted-foreground mt-1">支持多选，可拖拽调整顺序</p>
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
            <p className="text-xs text-muted-foreground text-right">
              共 {images.length} 张图片
            </p>
          )}
        </div>

        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>页面尺寸</Label>
              <Select value={pageSize} onValueChange={v => setPageSize(v as 'auto' | 'A4')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">自适应（按图片尺寸）</SelectItem>
                  <SelectItem value="A4">A4 标准尺寸</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {pageSize === 'auto'
                  ? '每页尺寸与图片相同，无缩放'
                  : '图片将按比例缩放适配 A4 页面'}
              </p>
            </div>

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">
                  正在转换... {progress}%
                </p>
              </motion.div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleConvert}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    转换中...
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    生成 PDF
                  </>
                )}
              </Button>
              {isProcessing && (
                <Button variant="outline" onClick={handleCancel}>
                  <XCircle className="mr-2 h-4 w-4" />
                  取消
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
