import { useState } from 'react'
import { motion } from 'framer-motion'
import { Scissors, Loader2, Info, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import type { UsePDFReturn } from '@/hooks/usePDF'
import type { CancellationToken } from '@/lib/cancellation'

interface SplitPanelProps {
  pdf: UsePDFReturn
}

export function SplitPanel({ pdf }: SplitPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [rangeStr, setRangeStr] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cancelToken, setCancelToken] = useState<CancellationToken | null>(null)

  const selectedFileData = pdf.files.find(f => f.id === selectedFile)

  const handleSplit = async () => {
    if (!selectedFile || !rangeStr) return

    const token = createCancellationToken()
    setCancelToken(token)
    setIsProcessing(true)
    setProgress(0)

    try {
      const results = await pdf.splitFile(selectedFile, rangeStr, (p) => setProgress(p), token)
      if (results) {
        toast.success(`分割完成！生成 ${results.length} 个文件`)
      }
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info('操作已取消')
      } else {
        toast.error(`分割失败：${error instanceof Error ? error.message : String(error)}`)
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
          <Scissors className="h-5 w-5" />
          分割 PDF
        </CardTitle>
        <CardDescription>
          将 PDF 文件按页码范围分割为多个文件。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">请先添加 PDF 文件</p>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">选择文件</label>
              <div className="flex flex-wrap gap-2">
                {pdf.files.map(file => (
                  <Badge
                    key={file.id}
                    variant={selectedFile === file.id ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedFile(file.id)}
                  >
                    {file.name}
                  </Badge>
                ))}
              </div>
            </div>

            {selectedFileData && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>共 {selectedFileData.pageCount} 页</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">页码范围</label>
                  <input
                    type="text"
                    value={rangeStr}
                    onChange={(e) => setRangeStr(e.target.value)}
                    placeholder="例如: 1-3, 5, 7-10"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    支持格式：1-3（范围）、5（单页）、1-3, 5, 7-10（组合）
                  </p>
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
                  正在分割... {progress}%
                </p>
              </motion.div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSplit}
                disabled={!selectedFile || !rangeStr || isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    分割中...
                  </>
                ) : (
                  <>
                    <Scissors className="mr-2 h-4 w-4" />
                    分割文件
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
