import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ImageIcon,
  FileText as TextIcon,
  Loader2,
  XCircle,
  CheckSquare,
  Square,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOperation } from '@/hooks/useOperation'
import { useFileSelection } from '@/hooks/useFileSelection'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface ConvertPanelProps {
  pdf: UsePDFReturn
}

export function ConvertPanel({ pdf }: ConvertPanelProps) {
  const { t } = useTranslation()
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } =
    useFileSelection(pdf.files)
  const [convertType, setConvertType] = useState<'image' | 'text'>('image')
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.convert'),
    onCancelMessage: t('common.cancelled'),
  })

  const handleConvert = async () => {
    if (selectedCount === 0) return

    const fileIds = Array.from(selectedFiles)

    const result = await execute(
      async (onProgress, token) => {
        let successCount = 0
        for (let i = 0; i < fileIds.length; i++) {
          token.throwIfCancelled()

          const fileProgress = (p: number) => {
            const overall = Math.round((i / fileIds.length) * 100 + p / fileIds.length)
            onProgress(overall)
          }

          if (convertType === 'text') {
            const outputPath = await pdf.convertToText(fileIds[i], fileProgress, token)
            if (outputPath) successCount++
          } else {
            const outputPath = await pdf.convertToImages(
              fileIds[i],
              imageFormat,
              fileProgress,
              token,
            )
            if (outputPath) successCount++
          }
        }
        return successCount
      },
      { lockFileIds: fileIds },
    )

    if (result && result > 0) {
      toast.success(t('convert.allCompleted'))
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

  return (
    <Card>
      <CardHeader>
          <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          {t('panel.convert.title')}
        </CardTitle>
        <CardDescription>{t('panel.convert.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('panel.convert.selectFile')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('panel.convert.selectFile')}</label>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="mr-1 h-3.5 w-3.5" />
                      {t('fileSelection.deselectAll')}
                    </>
                  ) : (
                    <>
                      <Square className="mr-1 h-3.5 w-3.5" />
                      {t('fileSelection.selectAll')}
                    </>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {pdf.files.map((file) => (
                  <Badge
                    key={file.id}
                    variant={isSelected(file.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleFile(file.id)}
                  >
                    {file.name} ({file.pageCount})
                  </Badge>
                ))}
              </div>
              {selectedCount > 0 && (
                <p className="text-xs text-muted-foreground">                  {t('fileSelection.selected', { count: selectedCount })}</p>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 p-4 bg-muted rounded-lg"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('panel.convert.format')}</label>
                <div className="flex gap-2">
                  <Button
                    variant={convertType === 'image' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setConvertType('image')}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {t('panel.convert.imageType')}
                  </Button>
                  <Button
                    variant={convertType === 'text' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setConvertType('text')}
                  >
                    <TextIcon className="mr-2 h-4 w-4" />
                    {t('panel.convert.textType')}
                  </Button>
                </div>
              </div>

              {convertType === 'image' && (
                <div className="space-y-2">
                  <Label>{t('panel.convert.format')}</Label>
                  <Select
                    value={imageFormat}
                    onValueChange={(v) => setImageFormat(v as 'png' | 'jpg')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="jpg">JPG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="p-3 bg-background rounded border text-sm">
                <div className="text-muted-foreground mb-1">{t('panel.convert.format')}</div>
                <div className="text-sm">
                  {convertType === 'image'
                    ? `${imageFormat.toUpperCase()}`
                    : 'TXT'}
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
                      {t('common.processing')}
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {t('panel.convert.start')}
                    </>
                  )}
                </Button>
                {isProcessing && (
                  <Button variant="outline" onClick={cancel}>
                    <XCircle className="mr-2 h-4 w-4" />
                    {t('panel.convert.cancel')}
                  </Button>
                )}
              </div>
            </motion.div>

            {showConfirmDialog && (
              <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('panel.convert.start')}</DialogTitle>
                    <DialogDescription>
                      {t('panel.convert.confirmConvert', { count: selectedCount, format: imageFormat.toUpperCase() })}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                      {t('panel.convert.cancel')}
                    </Button>
                    <Button onClick={confirmImageConvert}>{t('panel.convert.start')}</Button>
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
                  {t('common.processing')} {progress}%
                </p>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
