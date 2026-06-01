import { useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCw, Trash2, FileOutput, Loader2, Info, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import type { UsePDFReturn } from '@/hooks/usePDF'
import type { CancellationToken } from '@/lib/cancellation'

interface PageOperationsProps {
  pdf: UsePDFReturn
}

type Operation = 'rotate' | 'delete' | 'extract'

export function PageOperations({ pdf }: PageOperationsProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [operation, setOperation] = useState<Operation>('rotate')
  const [pageRange, setPageRange] = useState('')
  const [rotateAngle, setRotateAngle] = useState(90)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cancelToken, setCancelToken] = useState<CancellationToken | null>(null)

  const selectedFileData = pdf.files.find(f => f.id === selectedFile)

  const handleOperation = async () => {
    if (!selectedFile || !pageRange) return

    const token = createCancellationToken()
    setCancelToken(token)
    setIsProcessing(true)
    setProgress(0)

    try {
      let result: string | null = null

      switch (operation) {
        case 'rotate':
          result = await pdf.rotatePages(selectedFile, pageRange, rotateAngle, (p) => setProgress(p), token)
          break
        case 'delete':
          result = await pdf.deletePages(selectedFile, pageRange, (p) => setProgress(p), token)
          break
        case 'extract':
          result = await pdf.extractPages(selectedFile, pageRange, (p) => setProgress(p), token)
          break
      }

      if (result) {
        const opNames = { rotate: '旋转', delete: '删除', extract: '提取' }
        toast.success(`${opNames[operation]}完成！保存至：${result}`)
      }
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info('操作已取消')
      } else {
        toast.error(`操作失败：${error instanceof Error ? error.message : String(error)}`)
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

  const operations: { id: Operation; label: string; icon: React.ReactNode }[] = [
    { id: 'rotate', label: '旋转页面', icon: <RotateCw className="h-4 w-4" /> },
    { id: 'delete', label: '删除页面', icon: <Trash2 className="h-4 w-4" /> },
    { id: 'extract', label: '提取页面', icon: <FileOutput className="h-4 w-4" /> },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCw className="h-5 w-5" />
          页面操作
        </CardTitle>
        <CardDescription>
          旋转、删除或提取 PDF 中的特定页面。
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
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>共 {selectedFileData.pageCount} 页</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">操作类型</label>
                  <div className="flex gap-2">
                    {operations.map(op => (
                      <Button
                        key={op.id}
                        variant={operation === op.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setOperation(op.id)}
                      >
                        {op.icon}
                        <span className="ml-2">{op.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {operation === 'rotate' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">旋转角度</label>
                    <div className="flex gap-2">
                      {[90, 180, 270].map(angle => (
                        <Button
                          key={angle}
                          variant={rotateAngle === angle ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRotateAngle(angle)}
                        >
                          {angle}°
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {operation === 'rotate' ? '旋转页面' : operation === 'delete' ? '删除页面' : '提取页面'}
                  </label>
                  <input
                    type="text"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
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
                  正在处理... {progress}%
                </p>
              </motion.div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleOperation}
                disabled={!selectedFile || !pageRange || isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    {operations.find(o => o.id === operation)?.icon}
                    <span className="ml-2">
                      {operation === 'rotate' ? '旋转页面' : operation === 'delete' ? '删除页面' : '提取页面'}
                    </span>
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
