import { useState } from 'react'
import { motion } from 'framer-motion'
import { Scissors, Loader2, Info, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useOperation } from '@/hooks/useOperation'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface SplitPanelProps {
  pdf: UsePDFReturn
}

export function SplitPanel({ pdf }: SplitPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [rangeStr, setRangeStr] = useState('')
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: '分割失败',
  })

  const selectedFileData = pdf.files.find((f) => f.id === selectedFile)

  const handleSplit = async () => {
    if (!selectedFile || !rangeStr) return

    const results = await execute(
      async (onProgress, token) => {
        return pdf.splitFile(selectedFile, rangeStr, onProgress, token)
      },
      { lockFileIds: [selectedFile] },
    )

    if (results) {
      toast.success(`分割完成！生成 ${results.length} 个文件`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="h-5 w-5" />
          分割 PDF
        </CardTitle>
        <CardDescription>将 PDF 文件按页码范围分割为多个文件。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">请先添加 PDF 文件</p>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">选择文件</label>
              <div className="flex flex-wrap gap-2">
                {pdf.files.map((file) => (
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
                <p className="text-sm text-muted-foreground text-center">正在分割... {progress}%</p>
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
                <Button variant="outline" onClick={cancel}>
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
