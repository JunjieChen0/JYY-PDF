import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { FileText, ArrowRight, Loader2, Upload, CheckSquare, Square } from 'lucide-react'
import { ErrorCode } from '@/lib/i18n'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import type { UsePDFReturn } from '@/hooks/usePDF'
import { useFileSelection } from '@/hooks/useFileSelection'
import { useOperation } from '@/hooks/useOperation'

interface ConvertOfficePanelProps {
  pdf: UsePDFReturn
}

export function ConvertOfficePanel({ pdf }: ConvertOfficePanelProps) {
  const { t } = useTranslation()
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } =
    useFileSelection(pdf.files)
  const [direction, setDirection] = useState<'pdfToWord' | 'wordToPdf'>('pdfToWord')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.convert'),
    onCancelMessage: t('common.cancelled'),
  })

  const handleWordToPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const result = await execute(async (onProgress, token) => {
      const validFiles: File[] = []
      for (let i = 0; i < files.length; i++) {
        token.throwIfCancelled()
        const file = files[i]
        const filePath = window.electronAPI.getPathForFile(file)
        if (!filePath) {
          toast.error(t('convert.wordReadFailed'))
          continue
        }
        const ext = filePath.split('.').pop()?.toLowerCase()
        if (!['doc', 'docx'].includes(ext || '')) {
          toast.warning(t('convert.invalidWordData'))
          continue
        }
        validFiles.push(file)
        onProgress(Math.round((validFiles.length / files.length) * 100))
      }
      let completed = 0
      for (let i = 0; i < validFiles.length; i++) {
        token.throwIfCancelled()
        const file = validFiles[i]
        const filePath = window.electronAPI.getPathForFile(file)
        await pdf.wordToPdf(
          filePath,
          (p) => onProgress(Math.round(((completed + p / 100) / validFiles.length) * 100)),
          token,
        )
        completed++
      }
      return completed
    })
    // Word 上传：源是 FileList 而非 PDF 文件 ID，不参与文件互斥锁
    void undefined

    if (result && result > 0) {
      toast.success(t('convert.allCompleted'))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePdfToWord = async () => {
    if (selectedCount === 0) {
      toast.error(t(ErrorCode.NO_PDF_SELECTED))
      return
    }

    const result = await execute(
      async (onProgress, token) => {
        let completed = 0
        for (const fileId of selectedFiles) {
          token.throwIfCancelled()
          await pdf.pdfToWord(
            fileId,
            (p) => onProgress(Math.round(((completed + p / 100) / selectedCount) * 100)),
            token,
          )
          completed++
        }
        return completed
      },
      { lockFileIds: Array.from(selectedFiles) },
    )

    if (result && result > 0) {
      toast.success(t('convert.allCompleted'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('panel.convertOffice.title')}
        </CardTitle>
        <CardDescription>{t('panel.convertOffice.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={direction === 'pdfToWord' ? 'default' : 'outline'}
            className="flex items-center gap-2"
            onClick={() => setDirection('pdfToWord')}
          >
            <FileText className="h-4 w-4" />
            {t('panel.convertOffice.pdfToWord')}
            <ArrowRight className="h-3 w-3" />
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant={direction === 'wordToPdf' ? 'default' : 'outline'}
            className="flex items-center gap-2"
            onClick={() => setDirection('wordToPdf')}
          >
            <FileText className="h-4 w-4" />
            {t('panel.convertOffice.wordToPdf')}
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
              <p className="text-sm text-muted-foreground">{t('panel.convertOffice.selectFiles')}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('panel.convertOffice.selectWordFiles')}</Label>
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
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                  {selectedCount > 0 && (
                    <p className="text-xs text-muted-foreground">{t('fileSelection.selected', { count: selectedCount })}</p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handlePdfToWord}
                  disabled={isProcessing || selectedCount === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.processing')}
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      {t('panel.convertOffice.startConvert')}
                    </>
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
                <p className="text-sm font-medium">{t('panel.convertOffice.selectWordFiles')}</p>
                <p className="text-xs text-muted-foreground mt-1">.docx / .doc</p>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.processing')}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t('panel.convertOffice.selectWordFiles')}
                  </>
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
            <p className="text-sm text-muted-foreground text-center">{t('common.processing')} {progress}%</p>
          </motion.div>
        )}

        {isProcessing && (
          <Button variant="destructive" className="w-full" onClick={cancel}>
            {t('panel.convertOffice.cancel')}
          </Button>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• {t('panel.convertOffice.pdfToWordHint')}</p>
          <p>• {t('panel.convertOffice.wordToPdfHint')}</p>
          <p>• {t('panel.convertOffice.complexLayoutHint')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
