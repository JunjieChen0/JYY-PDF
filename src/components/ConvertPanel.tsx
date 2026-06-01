import { useState } from 'react'
import { motion } from 'framer-motion'
import { ImageIcon, FileText as TextIcon, Loader2, XCircle, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import { useFileSelection } from '@/hooks/useFileSelection'
import type { UsePDFReturn } from '@/hooks/usePDF'
import type { CancellationToken } from '@/lib/cancellation'

interface ConvertPanelProps {
  pdf: UsePDFReturn
}

export function ConvertPanel({ pdf }: ConvertPanelProps) {
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } = useFileSelection(pdf.files)
  const [convertType, setConvertType] = useState<'image' | 'text'>('image')
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [cancelToken, setCancelToken] = useState<CancellationToken | null>(null)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)

  const handleConvert = async () => {
    if (selectedCount === 0) return

    const token = createCancellationToken()
    setCancelToken(token)
    setIsProcessing(true)
    setProgress(0)
    setCurrentFileIndex(0)

    const fileIds = Array.from(selectedFiles)
    let successCount = 0

    try {
      for (let i = 0; i < fileIds.length; i++) {
        token.throwIfCancelled()
        setCurrentFileIndex(i)

        const fileProgress = (p: number) => {
          const overall = Math.round(((i / fileIds.length) * 100) + (p / fileIds.length))
          setProgress(overall)
        }

        if (convertType === 'text') {
          const outputPath = await pdf.convertToText(fileIds[i], fileProgress, token)
          if (outputPath) successCount++
        } else {
          const outputPath = await pdf.convertToImages(fileIds[i], imageFormat, fileProgress, token)
          if (outputPath) successCount++
        }
      }

      if (successCount > 0) {
        toast.success(`转换完成！成功处理 ${successCount}/${fileIds.length} 个文件`)
      }
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info(`操作已取消（已完成 ${successCount}/${fileIds.length} 个文件）`)
      } else {
        toast.error(`转换失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setCurrentFileIndex(0)
      setCancelToken(null)
    }
  }

  const handleConvertClick = () => {
    if (convertType === 'image' && selectedCount > 0) {
      setShowConfirmDialog(true)
    } else {
      handleConvert()
    }
  }

  const confirmImageConvert = () => {
    setShowConfirmDialog(false)
    handleConvert()
  }

  const handleCancel = () => {
    cancelToken?.cancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          格式转换
        </CardTitle>
        <CardDescription>
          将PDF转换为图片或文本
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">请先添加PDF文件</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">选择文件</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  className="h-7 text-xs"
                >
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="mr-1 h-3.5 w-3.5" />
                      取消全选
                    </>
                  ) : (
                    <>
                      <Square className="mr-1 h-3.5 w-3.5" />
                      全选
                    </>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {pdf.files.map(file => (
                  <Badge
                    key={file.id}
                    variant={isSelected(file.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleFile(file.id)}
                  >
                    {file.name} ({file.pageCount}页)
                  </Badge>
                ))}
              </div>
              {selectedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  已选择 {selectedCount} 个文件
                </p>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 p-4 bg-muted rounded-lg"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">转换类型</label>
                <div className="flex gap-2">
                  <Button
                    variant={convertType === 'image' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setConvertType('image')}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    转图片
                  </Button>
                  <Button
                    variant={convertType === 'text' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setConvertType('text')}
                  >
                    <TextIcon className="mr-2 h-4 w-4" />
                    转文本
                  </Button>
                </div>
              </div>

              {convertType === 'image' && (
                <div className="space-y-2">
                  <Label>图片格式</Label>
                  <Select value={imageFormat} onValueChange={v => setImageFormat(v as 'png' | 'jpg')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG（推荐，保留透明背景）</SelectItem>
                      <SelectItem value="jpg">JPG（体积更小）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="p-3 bg-background rounded border text-sm">
                <div className="text-muted-foreground mb-1">转换说明</div>
                <div className="text-sm">
                  {convertType === 'image'
                    ? `将把PDF转换为 ${imageFormat.toUpperCase()} 图片，每页一张`
                    : `将提取PDF中的文字内容，生成纯文本文件`
                  }
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConvertClick}
                  disabled={selectedCount === 0 || isProcessing}
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
                      {selectedCount > 1 ? `转换 ${selectedCount} 个文件` : '开始转换'}
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

            {showConfirmDialog && (
              <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>确认转换</DialogTitle>
                    <DialogDescription>
                      将把 {selectedCount} 个PDF文件转换为 {imageFormat.toUpperCase()} 图片。确认继续？
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                      取消
                    </Button>
                    <Button onClick={confirmImageConvert}>
                      确认转换
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">
                  正在转换... {selectedCount > 1 ? `(${currentFileIndex + 1}/${selectedCount})` : ''} {progress}%
                </p>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
