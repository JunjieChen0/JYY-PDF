import { useState } from 'react'
import { motion } from 'framer-motion'
import { Hash, Loader2, XCircle, CheckSquare, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOperation } from '@/hooks/useOperation'
import { useFileSelection } from '@/hooks/useFileSelection'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface PageNumbersPanelProps {
  pdf: UsePDFReturn
}

export function PageNumbersPanel({ pdf }: PageNumbersPanelProps) {
  const { t } = useTranslation()
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } =
    useFileSelection(pdf.files)
  const [position, setPosition] = useState<
    'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  >('bottom-center')
  const [startNumber, setStartNumber] = useState(1)
  const [fontSize, setFontSize] = useState(12)
  const [color, setColor] = useState('#000000')
  const [format, setFormat] = useState<'simple' | 'ofTotal' | 'custom'>('simple')
  const [prefix, setPrefix] = useState('')
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.pageNumber'),
    onCancelMessage: t('errorPrefix.cancelled'),
  })

  const handleAddPageNumbers = async () => {
    if (selectedCount === 0) return
    setCurrentFileIndex(0)

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

          const outputPath = await pdf.addPageNumbers(
            fileIds[i],
            {
              position,
              startNumber,
              fontSize,
              color,
              format,
              prefix,
            },
            fileProgress,
            token,
          )
          if (outputPath) successCount++
        }
        return successCount
      },
      { lockFileIds: fileIds },
    )

    setCurrentFileIndex(0)

    if (result && result > 0) {
      toast.success(t('panel.pageNumbers.completed', { count: result, total: fileIds.length }))
    }
  }

  const sampleFile = pdf.files.find((f) => selectedFiles.has(f.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          {t('panel.pageNumbers.title')}
        </CardTitle>
        <CardDescription>{t('panel.pageNumbers.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('panel.pageNumbers.noFiles')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('panel.pageNumbers.selectFileLabel')}</label>
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
                    {file.name} ({file.pageCount}{t('panel.pageNumbers.pages')})
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
                <Label>{t('panel.pageNumbers.position')}</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as typeof position)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">{t('panel.pageNumbers.positionTopLeft')}</SelectItem>
                    <SelectItem value="top-center">{t('panel.pageNumbers.positionTopCenter')}</SelectItem>
                    <SelectItem value="top-right">{t('panel.pageNumbers.positionTopRight')}</SelectItem>
                    <SelectItem value="bottom-left">{t('panel.pageNumbers.positionBottomLeft')}</SelectItem>
                    <SelectItem value="bottom-center">{t('panel.pageNumbers.positionBottomCenter')}</SelectItem>
                    <SelectItem value="bottom-right">{t('panel.pageNumbers.positionBottomRight')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('panel.pageNumbers.format')}</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">{t('panel.pageNumbers.formatSimple')}</SelectItem>
                    <SelectItem value="ofTotal">{t('panel.pageNumbers.formatOfTotal')}</SelectItem>
                    <SelectItem value="custom">{t('panel.pageNumbers.formatCustom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {format === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="prefix">{t('panel.pageNumbers.prefix')}</Label>
                  <Input
                    id="prefix"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder={t('panel.pageNumbers.prefixPlaceholder')}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="startNumber">{t('panel.pageNumbers.startNumber')}</Label>
                <Input
                  id="startNumber"
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('panel.pageNumbers.fontSize', { size: fontSize })}</Label>
                <input
                  type="range"
                  min="8"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">{t('panel.pageNumbers.color')}</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    id="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {sampleFile && (
                <div className="p-3 bg-background rounded border text-sm">
                  <div className="text-muted-foreground mb-1">{t('panel.pageNumbers.preview')}</div>
                  <div className="font-mono">
                    {format === 'ofTotal'
                      ? `${startNumber} / ${sampleFile.pageCount}`
                      : format === 'custom'
                        ? `${prefix}${startNumber}`
                        : `${startNumber}`}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleAddPageNumbers}
                  disabled={selectedCount === 0 || isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('panel.pageNumbers.processing')}
                    </>
                  ) : (
                    <>
                      <Hash className="mr-2 h-4 w-4" />
                      {selectedCount > 1 ? t('panel.pageNumbers.startWithCount', { count: selectedCount }) : t('panel.pageNumbers.start')}
                    </>
                  )}
                </Button>
                {isProcessing && (
                  <Button variant="outline" onClick={cancel}>
                    <XCircle className="mr-2 h-4 w-4" />
                    {t('panel.pageNumbers.cancel')}
                  </Button>
                )}
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
                  {t('panel.pageNumbers.progress')}{' '}
                  {selectedCount > 1 ? `(${currentFileIndex + 1}/${selectedCount})` : ''} {progress}
                  %
                </p>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
