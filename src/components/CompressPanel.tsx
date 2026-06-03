import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileArchive, Loader2, XCircle, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useOperation } from '@/hooks/useOperation'
import { useFileSelection } from '@/hooks/useFileSelection'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface CompressPanelProps {
  pdf: UsePDFReturn
}

export function CompressPanel({ pdf }: CompressPanelProps) {
  const { t } = useTranslation()
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } =
    useFileSelection(pdf.files)
  const [compressLevel, setCompressLevel] = useState<'high' | 'medium' | 'low'>('medium')
  const [preserveMetadata, setPreserveMetadata] = useState(true)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.compress'),
  })

  const levelOptions = [
    {
      value: 'low',
      label: t('panel.compress.speedPriority'),
      desc: t('panel.compress.speedPriorityDesc'),
      speedHint: t('panel.compress.fast'),
    },
    {
      value: 'medium',
      label: t('panel.compress.balanced'),
      desc: t('panel.compress.balancedDesc'),
      speedHint: t('panel.compress.medium'),
    },
    {
      value: 'high',
      label: t('panel.compress.stabilityPriority'),
      desc: t('panel.compress.stabilityPriorityDesc'),
      speedHint: t('panel.compress.slow'),
    },
  ]

  const handleCompress = async () => {
    if (selectedCount === 0) return

    const fileIds = Array.from(selectedFiles)
    let successCount = 0

    const result = await execute(
      async (onProgress, token) => {
        for (let i = 0; i < fileIds.length; i++) {
          token.throwIfCancelled()
          setCurrentFileIndex(i)

          const fileProgress = (p: number) => {
            const overall = Math.round((i / fileIds.length) * 100 + p / fileIds.length)
            onProgress(overall)
          }

          const outputPath = await pdf.compressFile(
            fileIds[i],
            compressLevel,
            fileProgress,
            token,
            { preserveMetadata },
          )
          if (outputPath) successCount++
        }
        return successCount
      },
      { lockFileIds: fileIds },
    )

    setCurrentFileIndex(0)

    if (result && result > 0) {
      toast.success(t('panel.compress.completed', { count: result, total: fileIds.length }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          {t('panel.compress.title')}
        </CardTitle>
        <CardDescription>{t('panel.compress.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('panel.compress.selectFiles')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('panel.compress.selectFiles')}</label>
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

            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 p-4 bg-muted rounded-lg"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('panel.compress.level')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {levelOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={compressLevel === option.value ? 'default' : 'outline'}
                      className="flex flex-col h-auto py-3 items-start text-left"
                      onClick={() => setCompressLevel(option.value as typeof compressLevel)}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs opacity-80 font-normal">{option.desc}</div>
                      <div className="text-xs mt-1 text-muted-foreground font-normal">
                        {t('panel.compress.speedHint')}: {option.speedHint}
                      </div>
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
                <Label htmlFor="preserveMetadata" className="text-sm">
                  {t('panel.compress.preserveMetadata')}
                </Label>
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
                  {t('panel.compress.processing')}{' '}
                  {selectedCount > 1 ? `(${currentFileIndex + 1}/${selectedCount})` : ''} {progress}
                  %
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
                    {t('panel.compress.compressing')}
                  </>
                ) : (
                  <>
                    <FileArchive className="mr-2 h-4 w-4" />
                    {selectedCount > 1
                      ? t('panel.compress.compressFiles', { count: selectedCount })
                      : t('panel.compress.start')}
                  </>
                )}
              </Button>
              {isProcessing && (
                <Button variant="outline" onClick={cancel}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('panel.compress.cancel')}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
