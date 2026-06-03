import { useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCw, Trash2, FileOutput, Loader2, Info, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useOperation } from '@/hooks/useOperation'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface PageOperationsProps {
  pdf: UsePDFReturn
}

type Operation = 'rotate' | 'delete' | 'extract'

export function PageOperations({ pdf }: PageOperationsProps) {
  const { t } = useTranslation()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [operation, setOperation] = useState<Operation>('rotate')
  const [pageRange, setPageRange] = useState('')
  const [rotateAngle, setRotateAngle] = useState(90)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('panel.pageOps.errorPrefix'),
  })

  const selectedFileData = pdf.files.find((f) => f.id === selectedFile)

  const handleOperation = async () => {
    if (!selectedFile || !pageRange) return

    const result = await execute(
      async (onProgress, token) => {
        switch (operation) {
          case 'rotate':
            return pdf.rotatePages(selectedFile, pageRange, rotateAngle, onProgress, token)
          case 'delete':
            return pdf.deletePages(selectedFile, pageRange, onProgress, token)
          case 'extract':
            return pdf.extractPages(selectedFile, pageRange, onProgress, token)
        }
      },
      { lockFileIds: selectedFile ? [selectedFile] : undefined },
    )

    if (result) {
      const opKey = `${operation}Completed` as const
      toast.success(t(`panel.pageOps.${opKey}`, { path: result }))
    }
  }

  const operations: { id: Operation; label: string; icon: React.ReactNode }[] = [
    { id: 'rotate', label: t('panel.pageOps.rotate'), icon: <RotateCw className="h-4 w-4" /> },
    { id: 'delete', label: t('panel.pageOps.delete'), icon: <Trash2 className="h-4 w-4" /> },
    { id: 'extract', label: t('panel.pageOps.extract'), icon: <FileOutput className="h-4 w-4" /> },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCw className="h-5 w-5" />
          {t('panel.pageOps.title')}
        </CardTitle>
        <CardDescription>{t('panel.pageOps.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('panel.pageOps.selectFile')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('panel.pageOps.selectFileLabel')}</label>
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
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>{t('panel.pageOps.totalPages', { count: selectedFileData.pageCount })}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('panel.pageOps.operationType')}</label>
                  <div className="flex gap-2">
                    {operations.map((op) => (
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
                    <label className="text-sm font-medium">{t('panel.pageOps.angle')}</label>
                    <div className="flex gap-2">
                      {[90, 180, 270].map((angle) => (
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
                    {t('panel.pageOps.pageRangeLabel')}
                  </label>
                  <input
                    type="text"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                    placeholder={t('panel.pageOps.pageRangePlaceholder')}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('panel.pageOps.pageRangeHint')}
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
                <p className="text-sm text-muted-foreground text-center">{t('panel.pageOps.processing', { progress })}</p>
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
                    {t('panel.pageOps.processingBtn')}
                  </>
                ) : (
                  <>
                    {operations.find((o) => o.id === operation)?.icon}
                    <span className="ml-2">
                      {t(`panel.pageOps.${operation}`)}
                    </span>
                  </>
                )}
              </Button>
              {isProcessing && (
                <Button variant="outline" onClick={cancel}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('panel.pageOps.cancel')}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
