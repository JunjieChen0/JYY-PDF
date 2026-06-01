import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileArchive, Loader2, XCircle, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import { useFileSelection } from '@/hooks/useFileSelection'
import type { UsePDFReturn } from '@/hooks/usePDF'
import type { CancellationToken } from '@/lib/cancellation'

interface CompressPanelProps {
  pdf: UsePDFReturn
}

export function CompressPanel({ pdf }: CompressPanelProps) {
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } = useFileSelection(pdf.files)
  const [compressLevel, setCompressLevel] = useState<'high' | 'medium' | 'low'>('medium')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cancelToken, setCancelToken] = useState<CancellationToken | null>(null)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [preserveMetadata, setPreserveMetadata] = useState(true)

  const levelOptions = [
    { value: 'low', label: '轻度', desc: '保留更多细节，压缩较轻', sizeReduction: '~30%' },
    { value: 'medium', label: '标准', desc: '平衡压缩率与质量', sizeReduction: '~60%' },
    { value: 'high', label: '极致', desc: '最大压缩，文件最小', sizeReduction: '~80%' },
  ]

  const handleCompress = async () => {
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

        const outputPath = await pdf.compressFile(fileIds[i], compressLevel, fileProgress, token, { preserveMetadata })
        if (outputPath) {
          successCount++
        }
      }

      if (successCount > 0) {
        toast.success(`压缩完成！成功处理 ${successCount}/${fileIds.length} 个文件`)
      }
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info(`操作已取消（已完成 ${successCount}/${fileIds.length} 个文件）`)
      } else {
        toast.error(`压缩失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setCurrentFileIndex(0)
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
          <FileArchive className="h-5 w-5" />
          压缩PDF
        </CardTitle>
        <CardDescription>
          减小PDF文件体积，支持三种压缩等级
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
                    {file.name}
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
                <label className="text-sm font-medium">压缩等级</label>
                <div className="grid grid-cols-3 gap-2">
                  {levelOptions.map(option => (
                    <Button
                      key={option.value}
                      variant={compressLevel === option.value ? 'default' : 'outline'}
                      className="flex flex-col h-auto py-3 items-start text-left"
                      onClick={() => setCompressLevel(option.value as typeof compressLevel)}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs opacity-80 font-normal">{option.desc}</div>
                      <div className="text-xs mt-1 text-green-400 font-normal">预计减少{option.sizeReduction}</div>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="preserveMetadata"
                  checked={preserveMetadata}
                  onCheckedChange={setPreserveMetadata}
                />
                <Label htmlFor="preserveMetadata" className="text-sm">保留文档元数据（标题、作者等）</Label>
              </div>
            </motion.div>

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">
                  正在压缩... {selectedCount > 1 ? `(${currentFileIndex + 1}/${selectedCount})` : ''} {progress}%
                </p>
              </motion.div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleCompress}
                disabled={selectedCount === 0 || isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    压缩中...
                  </>
                ) : (
                  <>
                    <FileArchive className="mr-2 h-4 w-4" />
                    {selectedCount > 1 ? `压缩 ${selectedCount} 个文件` : '开始压缩'}
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
