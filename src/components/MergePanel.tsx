import { motion } from 'framer-motion'
import { Merge, ArrowUpDown, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useOperation } from '@/hooks/useOperation'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface MergePanelProps {
  pdf: UsePDFReturn
}

export function MergePanel({ pdf }: MergePanelProps) {
  const { t } = useTranslation()
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.merge'),
  })

  const handleMerge = async () => {
    if (pdf.files.length < 2) return

    const fileIds = pdf.files.map((f) => f.id)
    const outputPath = await execute(
      async (onProgress, token) => {
        return pdf.mergeFiles(onProgress, token)
      },
      { lockFileIds: fileIds },
    )

    if (outputPath) {
      toast.success(t('panel.merge.completedWithPath', { path: outputPath }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Merge className="h-5 w-5" />
          {t('panel.merge.title')}
        </CardTitle>
        <CardDescription>{t('panel.merge.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowUpDown className="h-4 w-4" />
          <span>{t('panel.merge.dragHint')}</span>
        </div>

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2"
          >
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">{t('panel.merge.processing')} {progress}%</p>
          </motion.div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleMerge}
            disabled={pdf.files.length < 2 || isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('panel.merge.merging')}
              </>
            ) : (
              <>
                <Merge className="mr-2 h-4 w-4" />
                {t('panel.merge.mergeFiles', { count: pdf.files.length })}
              </>
            )}
          </Button>
          {isProcessing && (
            <Button variant="outline" onClick={cancel}>
              <XCircle className="mr-2 h-4 w-4" />
              {t('panel.merge.cancel')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
