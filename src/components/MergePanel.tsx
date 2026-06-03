import { motion } from 'framer-motion'
import { Merge, ArrowUpDown, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useOperation } from '@/hooks/useOperation'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface MergePanelProps {
  pdf: UsePDFReturn
}

export function MergePanel({ pdf }: MergePanelProps) {
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: '合并失败',
  })

  const handleMerge = async () => {
    if (pdf.files.length < 2) return

    const fileIds = pdf.files.map((f) => f.id)
    const outputPath = await execute(
      async (onProgress, token) => {
        return pdf.mergeFiles(onProgress, token)
      },
      { lockFileIds: fileIds },
    )

    if (outputPath) {
      toast.success(`合并完成！保存至：${outputPath}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Merge className="h-5 w-5" />
          合并 PDF
        </CardTitle>
        <CardDescription>将多个 PDF 文件合并为一个文件。拖拽文件列表可调整顺序。</CardDescription>
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
            <p className="text-sm text-muted-foreground text-center">正在合并... {progress}%</p>
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
            <Button variant="outline" onClick={cancel}>
              <XCircle className="mr-2 h-4 w-4" />
              取消
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
