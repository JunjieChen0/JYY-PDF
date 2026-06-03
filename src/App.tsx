import { motion } from 'framer-motion'
import { FileText, Moon, Sun } from 'lucide-react'
import { useState, useEffect, Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'

import { APP_VERSION } from '@/lib/build-info'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { FileDropZone } from '@/components/FileDropZone'
import { FileList } from '@/components/FileList'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { usePDF } from '@/hooks/usePDF'
import { useGlobalProcessing } from '@/hooks/useGlobalProcessing'

const MergePanel = lazy(() =>
  import('@/components/MergePanel').then((m) => ({ default: m.MergePanel })),
)
const SplitPanel = lazy(() =>
  import('@/components/SplitPanel').then((m) => ({ default: m.SplitPanel })),
)
const PageOperations = lazy(() =>
  import('@/components/PageOperations').then((m) => ({ default: m.PageOperations })),
)
const CompressPanel = lazy(() =>
  import('@/components/CompressPanel').then((m) => ({ default: m.CompressPanel })),
)
const EncryptPanel = lazy(() =>
  import('@/components/EncryptPanel').then((m) => ({ default: m.EncryptPanel })),
)
const WatermarkPanel = lazy(() =>
  import('@/components/WatermarkPanel').then((m) => ({ default: m.WatermarkPanel })),
)
const PageNumbersPanel = lazy(() =>
  import('@/components/PageNumbersPanel').then((m) => ({ default: m.PageNumbersPanel })),
)
const ConvertPanel = lazy(() =>
  import('@/components/ConvertPanel').then((m) => ({ default: m.ConvertPanel })),
)
const ImagesToPdfPanel = lazy(() =>
  import('@/components/ImagesToPdfPanel').then((m) => ({ default: m.ImagesToPdfPanel })),
)
const SignaturePanel = lazy(() =>
  import('@/components/SignaturePanel').then((m) => ({ default: m.SignaturePanel })),
)
const EditPanel = lazy(() =>
  import('@/components/EditPanel').then((m) => ({ default: m.EditPanel })),
)
const OcrPanel = lazy(() => import('@/components/OcrPanel').then((m) => ({ default: m.OcrPanel })))
const ConvertOfficePanel = lazy(() =>
  import('@/components/ConvertOfficePanel').then((m) => ({ default: m.ConvertOfficePanel })),
)

function App() {
  const { t } = useTranslation()
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('jyy_pdf_dark_mode') === '1'
    } catch {
      return false
    }
  })
  const pdf = usePDF()
  const isAnyProcessing = useGlobalProcessing()

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      localStorage.setItem('jyy_pdf_dark_mode', darkMode ? '1' : '0')
    } catch {
      // localStorage 不可用时静默忽略
    }
  }, [darkMode])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="border-b shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="text-primary"
            >
              <FileText className="h-6 w-6" />
            </motion.div>
            <h1 className="text-lg font-bold">JYY PDF</h1>
            <span className="text-sm text-muted-foreground font-medium ml-1">v{APP_VERSION}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(darkMode ? 'app.lightMode' : 'app.darkMode')}
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          <div className="container py-4 px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <FileDropZone onFiles={pdf.addFiles} disabled={isAnyProcessing} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">{t('app.fileListTitle')}</h2>
                      <span className="text-sm text-muted-foreground">
                        {t('app.fileCount', { count: pdf.files.length })}
                      </span>
                    </div>
                    <Separator className="mb-4" />
                    <div className="h-[300px]">
                      <FileList
                        files={pdf.files}
                        onRemove={pdf.removeFile}
                        onReorder={pdf.reorderFiles}
                        getThumbnail={pdf.getPageThumbnail}
                      />
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <Tabs defaultValue="merge" className="w-full">
                    <TabsList className="w-full flex flex-wrap h-auto gap-1">
                      <TabsTrigger value="merge" className="flex-1 min-w-[60px]">
                        {t('app.tab.merge')}
                      </TabsTrigger>
                      <TabsTrigger value="split" className="flex-1 min-w-[60px]">
                        {t('app.tab.split')}
                      </TabsTrigger>
                      <TabsTrigger value="pages" className="flex-1 min-w-[60px]">
                        {t('app.tab.pageOps')}
                      </TabsTrigger>
                      <TabsTrigger value="compress" className="flex-1 min-w-[60px]">
                        {t('app.tab.compress')}
                      </TabsTrigger>
                      <TabsTrigger value="encrypt" className="flex-1 min-w-[60px]">
                        {t('app.tab.encrypt')}
                      </TabsTrigger>
                      <TabsTrigger value="watermark" className="flex-1 min-w-[60px]">
                        {t('app.tab.watermark')}
                      </TabsTrigger>
                      <TabsTrigger value="pagenum" className="flex-1 min-w-[60px]">
                        {t('app.tab.pageNumbers')}
                      </TabsTrigger>
                      <TabsTrigger value="convert" className="flex-1 min-w-[60px]">
                        {t('app.tab.convert')}
                      </TabsTrigger>
                      <TabsTrigger value="img2pdf" className="flex-1 min-w-[60px]">
                        {t('app.tab.imagesToPdf')}
                      </TabsTrigger>
                      <TabsTrigger value="office" className="flex-1 min-w-[60px]">
                        {t('app.tab.convertOffice')}
                      </TabsTrigger>
                      <TabsTrigger value="ocr" className="flex-1 min-w-[60px]">
                        {t('app.tab.ocr')}
                      </TabsTrigger>
                      <TabsTrigger value="edit" className="flex-1 min-w-[60px]">
                        {t('app.tab.edit')}
                      </TabsTrigger>
                      <TabsTrigger value="sign" className="flex-1 min-w-[60px]">
                        {t('app.tab.signature')}
                      </TabsTrigger>
                    </TabsList>
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
                          {t('common.processing')}
                        </div>
                      }
                    >
                      <TabsContent value="merge">
                        <ErrorBoundary>
                          <MergePanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="split">
                        <ErrorBoundary>
                          <SplitPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="pages">
                        <ErrorBoundary>
                          <PageOperations pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="compress">
                        <ErrorBoundary>
                          <CompressPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="encrypt">
                        <ErrorBoundary>
                          <EncryptPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="watermark">
                        <ErrorBoundary>
                          <WatermarkPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="pagenum">
                        <ErrorBoundary>
                          <PageNumbersPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="convert">
                        <ErrorBoundary>
                          <ConvertPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="img2pdf">
                        <ErrorBoundary>
                          <ImagesToPdfPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="office">
                        <ErrorBoundary>
                          <ConvertOfficePanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="ocr">
                        <ErrorBoundary>
                          <OcrPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="edit">
                        <ErrorBoundary>
                          <EditPanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                      <TabsContent value="sign">
                        <ErrorBoundary>
                          <SignaturePanel pdf={pdf} />
                        </ErrorBoundary>
                      </TabsContent>
                    </Suspense>
                  </Tabs>
                </motion.div>
              </div>
            </div>
          </div>
        </ErrorBoundary>
      </main>

      <Toaster position="top-center" richColors />
    </div>
  )
}

export default App
