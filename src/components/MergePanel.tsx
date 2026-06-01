import { useState } from 'react'
import { motion } from 'framer-motion'
import { Merge, ArrowUpDown, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import type { UsePDFReturn } from '@/hooks/usePDF'
import type { CancellationToken } from '@/lib/cancellation'

interface MergePanelProps {
  pdf: UsePDFReturn
}

export function MergePanel({ pdf }: MergePanelProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cancelToken, setCancelToken] = useState<CancellationToken | null>(null)

  const handleMerge = async () => {
    if (pdf.files.length < 2) return

    const token = createCancellationToken()
    setCancelToken(token)
    setIsProcessing(true)
    setProgress(0)

    try {
      const outputPath = await pdf.mergeFiles((p) => setProgress(p), token)
      if (outputPath) {
        toast.success(`合并完成！保存至：${outputPath}`)
      }
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info('操作已取消')
      } else {
        toast.error(`合并失败：${error instanceof Error ? error.message : String(error)}`)
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
          <Merge className="h-5 w-5" />
          合并 PDF
        </CardTitle>
        <CardDescription>
          将多个 PDF 文件合并为一个文件。拖拽文件列表可调整顺序。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowUpDown className="h-4 w-4" />
          <span>拖拽文件调整合并顺序</span>
        </div>
        
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2"
          >
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              正在合并... {progress}%
            </p>
          </motion.div>
        )}
        
        <div className="flex gap-2">
          <Button
            onClick={handleMerge}
            disabled={pdf.files.length < 2 || isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                合并中...
              </>
            ) : (
              <>
                <Merge className="mr-2 h-4 w-4" />
                合并 {pdf.files.length} 个文件
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
      </CardContent>
    </Card>
  )
}
