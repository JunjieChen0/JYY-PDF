import { useState } from 'react'
import { motion } from 'framer-motion'
import { ScanText, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { UsePDFReturn } from '@/hooks/usePDF'
import { useFileSelection } from '@/hooks/useFileSelection'
import { useOperation } from '@/hooks/useOperation'

interface OcrPanelProps {
  pdf: UsePDFReturn
}

const LANGUAGES = [
  { value: 'chi_sim+eng', label: '中文简体 + 英文' },
  { value: 'chi_tra+eng', label: '中文繁体 + 英文' },
  { value: 'eng', label: '仅英文' },
  { value: 'jpn+eng', label: '日文 + 英文' },
  { value: 'kor+eng', label: '韩文 + 英文' },
]

export function OcrPanel({ pdf }: OcrPanelProps) {
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } = useFileSelection(pdf.files)
  const [language, setLanguage] = useState('chi_sim+eng')
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: 'OCR失败',
    onCancelMessage: '已取消OCR操作',
  })

  const handleOcr = async () => {
    if (selectedCount === 0) {
      toast.error('请先选择PDF文件')
      return
    }

    const result = await execute(async (onProgress, token) => {
      let completed = 0
      for (const fileId of selectedFiles) {
        token.throwIfCancelled()
        await pdf.ocrPDF(
          fileId,
          language,
          p => onProgress(Math.round(((completed + p / 100) / selectedCount) * 100)),
          token
        )
        completed++
      }
      return completed
    })

    if (result) {
      toast.success('全部OCR完成！')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanText className="h-5 w-5" />
          OCR文字识别
        </CardTitle>
        <CardDescription>
          从扫描版PDF中提取文字，支持100+种语言
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

            <div className="space-y-2">
              <Label>识别语言</Label>
              <Select value={language} onValueChange={v => setLanguage(v as typeof language)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {!isProcessing ? (
                <Button
                  className="flex-1"
                  onClick={handleOcr}
                  disabled={selectedCount === 0}
                >
                  <ScanText className="mr-2 h-4 w-4" />
                  开始识别
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={cancel}
                >
                  取消
                </Button>
              )}
            </div>

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">
                  正在识别... {progress}%
                </p>
              </motion.div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• 首次使用需下载语言模型（约25MB），请耐心等待</p>
              <p>• 中文识别速度约5-15秒/页，英文约2-5秒/页</p>
              <p>• 建议选择与文档匹配的语言以获得最佳效果</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
