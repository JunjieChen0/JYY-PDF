import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { FileText, ArrowRight, Loader2, Upload, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import type { UsePDFReturn } from '@/hooks/usePDF'
import { useFileSelection } from '@/hooks/useFileSelection'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import type { CancellationToken } from '@/lib/cancellation'

interface ConvertOfficePanelProps {
  pdf: UsePDFReturn
}

export function ConvertOfficePanel({ pdf }: ConvertOfficePanelProps) {
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } = useFileSelection(pdf.files)
  const [direction, setDirection] = useState<'pdfToWord' | 'wordToPdf'>('pdfToWord')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cancelToken, setCancelToken] = useState<CancellationToken | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleWordToPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const token = createCancellationToken()
    setCancelToken(token)
    setIsProcessing(true)
    setProgress(0)

    try {
      for (let i = 0; i < files.length; i++) {
        token.throwIfCancelled()
        const file = files[i]
        setProgress(Math.round((i / files.length) * 100))
        const filePath = window.electronAPI.getPathForFile(file)
        if (!filePath) {
          toast.error(`无法获取文件路径：${file.name}`)
          continue
        }
        const ext = filePath.split('.').pop()?.toLowerCase()
        if (!['doc', 'docx'].includes(ext || '')) {
          toast.warning(`跳过非Word文件：${file.name}`)
          continue
        }
        await pdf.wordToPdf(
          filePath,
          p => setProgress(Math.round(((i + p / 100) / files.length) * 100)),
          token
        )
      }
      toast.success('全部转换完成！')
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info('已取消转换')
      } else {
        toast.error(`转换失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setIsProcessing(false)
      setCancelToken(null)
      setProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePdfToWord = async () => {
    if (selectedCount === 0) {
      toast.error('请先选择PDF文件')
      return
    }

    const token = createCancellationToken()
    setCancelToken(token)
    setIsProcessing(true)
    setProgress(0)

    try {
      let completed = 0
      for (const fileId of selectedFiles) {
        token.throwIfCancelled()
        await pdf.pdfToWord(
          fileId,
          p => setProgress(Math.round(((completed + p / 100) / selectedCount) * 100)),
          token
        )
        completed++
      }
      toast.success('全部转换完成！')
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info('已取消转换')
      } else {
        toast.error(`转换失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setIsProcessing(false)
      setCancelToken(null)
      setProgress(0)
    }
  }

  const handleCancel = () => {
    cancelToken?.cancel()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          格式转换
        </CardTitle>
        <CardDescription>
          PDF与Word文档互相转换
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={direction === 'pdfToWord' ? 'default' : 'outline'}
            className="flex items-center gap-2"
            onClick={() => setDirection('pdfToWord')}
          >
            <FileText className="h-4 w-4" />
            PDF → Word
            <ArrowRight className="h-3 w-3" />
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant={direction === 'wordToPdf' ? 'default' : 'outline'}
            className="flex items-center gap-2"
            onClick={() => setDirection('wordToPdf')}
          >
            <FileText className="h-4 w-4" />
            Word → PDF
            <ArrowRight className="h-3 w-3" />
            <FileText className="h-4 w-4" />
          </Button>
        </div>

        {direction === 'pdfToWord' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {pdf.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">请先添加PDF文件</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>选择文件</Label>
                    <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                      {isAllSelected ? (
                        <><CheckSquare className="mr-1 h-3.5 w-3.5" />取消全选</>
                      ) : (
                        <><Square className="mr-1 h-3.5 w-3.5" />全选</>
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
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                  {selectedCount > 0 && (
                    <p className="text-xs text-muted-foreground">已选择 {selectedCount} 个文件</p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handlePdfToWord}
                  disabled={isProcessing || selectedCount === 0}
                >
                  {isProcessing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />转换中...</>
                  ) : (
                    <><FileText className="mr-2 h-4 w-4" />开始转换</>
                  )}
                </Button>
              </>
            )}
          </motion.div>
        )}

        {direction === 'wordToPdf' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">选择 Word 文档</p>
                <p className="text-xs text-muted-foreground mt-1">支持 .docx / .doc 格式</p>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />转换中...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />选择文件</>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx"
                multiple
                className="hidden"
                onChange={handleWordToPdfUpload}
              />
            </div>
          </motion.div>
        )}

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

        {isProcessing && (
          <Button variant="destructive" className="w-full" onClick={handleCancel}>
            取消
          </Button>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• PDF→Word：提取文字内容生成Word文档（纯文本格式）</p>
          <p>• Word→PDF：保持原始排版转换为PDF（需要mammoth库）</p>
          <p>• 复杂排版的文档转换后可能需要手动调整</p>
        </div>
      </CardContent>
    </Card>
  )
}
