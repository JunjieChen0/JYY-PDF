import { useState } from 'react'
import { motion } from 'framer-motion'
import { Scissors, Loader2, Info, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [rangeStr, setRangeStr] = useState('')
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.split'),
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
      toast.success(t('panel.split.completed', { count: results.length }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="h-5 w-5" />
          {t('panel.split.title')}
        </CardTitle>
        <CardDescription>{t('panel.split.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('panel.split.noFiles')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('panel.split.selectFileLabel')}</label>
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
                  <span>{t('panel.split.totalPages', { count: selectedFileData.pageCount })}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('panel.split.label')}</label>
                  <input
                    type="text"
                    value={rangeStr}
                    onChange={(e) => setRangeStr(e.target.value)}
                    placeholder={t('panel.split.placeholder')}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('panel.split.hint')}
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
                <p className="text-sm text-muted-foreground text-center">{t('panel.split.processing')} {progress}%</p>
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
                    {t('panel.split.splitting')}
                  </>
                ) : (
                  <>
                    <Scissors className="mr-2 h-4 w-4" />
                    {t('panel.split.splitFile')}
                  </>
                )}
              </Button>
              {isProcessing && (
                <Button variant="outline" onClick={cancel}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('panel.split.cancel')}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
