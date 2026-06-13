import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorCode } from '@/lib/i18n'
import { motion } from 'framer-motion'
import { ScanText, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
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
import type { UsePDFReturn } from '@/hooks/usePDF'
import { useFileSelection } from '@/hooks/useFileSelection'
import { useOperation } from '@/hooks/useOperation'

interface OcrPanelProps {
  pdf: UsePDFReturn
}

export function OcrPanel({ pdf }: OcrPanelProps) {
  const { t } = useTranslation()
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } =
    useFileSelection(pdf.files)

  const LANGUAGES = [
    { value: 'chi_sim+eng', label: t('panel.ocr.langChineseSimplified') },
    { value: 'chi_tra+eng', label: t('panel.ocr.langChineseTraditional') },
    { value: 'eng', label: t('panel.ocr.langEnglishOnly') },
    { value: 'jpn+eng', label: t('panel.ocr.langJapanese') },
    { value: 'kor+eng', label: t('panel.ocr.langKorean') },
  ]

  const [language, setLanguage] = useState('chi_sim+eng')
  const [useOfflineMode, setUseOfflineMode] = useState<boolean | null>(null)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.ocr'),
    onCancelMessage: t('panel.ocr.cancelMessage'),
  })

  // 检查是否可以使用离线模式
  const checkOfflineMode = async () => {
    if (window.electronAPI?.getAppPath && window.electronAPI?.checkFileExists) {
      const appPath = window.electronAPI.getAppPath()
      const langCodes = language.split('+')
      let allExist = true
      for (const code of langCodes) {
        const langPath = `${appPath}/public/tesseract/langs/${code}.traineddata.gz`
        const exists = await window.electronAPI.checkFileExists(langPath)
        if (!exists) {
          allExist = false
          break
        }
      }
      setUseOfflineMode(allExist)
    } else {
      setUseOfflineMode(false)
    }
  }

  useEffect(() => {
    checkOfflineMode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const handleOcr = async () => {
    if (selectedCount === 0) {
      toast.error(t(ErrorCode.NO_PDF_SELECTED))
      return
    }

    const result = await execute(
      async (onProgress, token) => {
        let completed = 0
        for (const fileId of selectedFiles) {
          token.throwIfCancelled()
          await pdf.ocrPDF(
            fileId,
            language,
            (p) => onProgress(Math.round(((completed + p / 100) / selectedCount) * 100)),
            token,
          )
          completed++
        }
        return completed
      },
      { lockFileIds: Array.from(selectedFiles) },
    )

    if (result) {
      toast.success(t('panel.ocr.completed'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanText className="h-5 w-5" />
          {t('panel.ocr.title')}
        </CardTitle>
        <CardDescription>{t('panel.ocr.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('panel.ocr.noFiles')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('panel.ocr.selectFileLabel')}</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="mr-1 h-3.5 w-3.5" />
                      {t('panel.ocr.deselectAll')}
                    </>
                  ) : (
                    <>
                      <Square className="mr-1 h-3.5 w-3.5" />
                      {t('panel.ocr.selectAll')}
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
                <p className="text-xs text-muted-foreground">{t('panel.ocr.selectedCount', { count: selectedCount })}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('panel.ocr.language')}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {!isProcessing ? (
                <Button className="flex-1" onClick={handleOcr} disabled={selectedCount === 0}>
                  <ScanText className="mr-2 h-4 w-4" />
                  {t('panel.ocr.start')}
                </Button>
              ) : (
                <Button variant="destructive" className="flex-1" onClick={cancel}>
                  {t('panel.ocr.cancel')}
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
                <p className="text-sm text-muted-foreground text-center">{t('panel.ocr.recognizing', { progress })}</p>
              </motion.div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• {t('panel.ocr.downloadModelHint')}</p>
              {useOfflineMode === true && (
                <p className="text-green-600">✓ {t('panel.ocr.offlineModeHint')}</p>
              )}
              {useOfflineMode === false && (
                <p className="text-orange-600">⚠ {t('panel.ocr.onlineModeHint')}</p>
              )}
              <p>• {t('panel.ocr.speedHint')}</p>
              <p>• {t('panel.ocr.languageHint')}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
