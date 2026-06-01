import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Moon, Sun } from 'lucide-react'
import { useState, useEffect, useCallback, Suspense, lazy, useMemo } from 'react'
import { Toaster } from 'sonner'

const APP_VERSION = '2.5.0'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { FileDropZone } from '@/components/FileDropZone'
import { FileList } from '@/components/FileList'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { usePDF } from '@/hooks/usePDF'

const MergePanel = lazy(() => import('@/components/MergePanel').then(m => ({ default: m.MergePanel })))
const SplitPanel = lazy(() => import('@/components/SplitPanel').then(m => ({ default: m.SplitPanel })))
const PageOperations = lazy(() => import('@/components/PageOperations').then(m => ({ default: m.PageOperations })))
const CompressPanel = lazy(() => import('@/components/CompressPanel').then(m => ({ default: m.CompressPanel })))
const EncryptPanel = lazy(() => import('@/components/EncryptPanel').then(m => ({ default: m.EncryptPanel })))
const WatermarkPanel = lazy(() => import('@/components/WatermarkPanel').then(m => ({ default: m.WatermarkPanel })))
const PageNumbersPanel = lazy(() => import('@/components/PageNumbersPanel').then(m => ({ default: m.PageNumbersPanel })))
const ConvertPanel = lazy(() => import('@/components/ConvertPanel').then(m => ({ default: m.ConvertPanel })))
const ImagesToPdfPanel = lazy(() => import('@/components/ImagesToPdfPanel').then(m => ({ default: m.ImagesToPdfPanel })))
const SignaturePanel = lazy(() => import('@/components/SignaturePanel').then(m => ({ default: m.SignaturePanel })))
const EditPanel = lazy(() => import('@/components/EditPanel').then(m => ({ default: m.EditPanel })))
const OcrPanel = lazy(() => import('@/components/OcrPanel').then(m => ({ default: m.OcrPanel })))
const ConvertOfficePanel = lazy(() => import('@/components/ConvertOfficePanel').then(m => ({ default: m.ConvertOfficePanel })))

function ConfettiEffect() {
  const confetti = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 3,
    color: ['#ff6b9d', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6b6b', '#c084fc'][i % 6],
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
  })), [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {confetti.map((c) => (
        <motion.div
          key={c.id}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: '100vh',
            opacity: [1, 1, 0],
            rotate: c.rotate + 720,
            x: [0, Math.random() > 0.5 ? 30 : -30, 0],
          }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute rounded-sm"
          style={{
            left: c.left,
            width: c.size,
            height: c.size,
            backgroundColor: c.color,
          }}
        />
      ))}
    </div>
  )
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('jyy_pdf_dark_mode') === '1'
    } catch {
      return false
    }
  })
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return !localStorage.getItem('jyy_pdf_welcome_seen')
    } catch {
      return true
    }
  })
  const pdf = usePDF()

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false)
    try {
      localStorage.setItem('jyy_pdf_welcome_seen', '1')
    } catch {
      // localStorage 不可用时静默忽略
    }
  }, [])

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
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
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
                  <FileDropZone onFiles={pdf.addFiles} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">文件列表</h2>
                      <span className="text-sm text-muted-foreground">
                        {pdf.files.length} 个文件
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
                      <TabsTrigger value="merge" className="flex-1 min-w-[60px]">合并</TabsTrigger>
                      <TabsTrigger value="split" className="flex-1 min-w-[60px]">分割</TabsTrigger>
                      <TabsTrigger value="pages" className="flex-1 min-w-[60px]">页面</TabsTrigger>
                      <TabsTrigger value="compress" className="flex-1 min-w-[60px]">压缩</TabsTrigger>
                      <TabsTrigger value="encrypt" className="flex-1 min-w-[60px]">加密</TabsTrigger>
                      <TabsTrigger value="watermark" className="flex-1 min-w-[60px]">水印</TabsTrigger>
                      <TabsTrigger value="pagenum" className="flex-1 min-w-[60px]">页码</TabsTrigger>
                      <TabsTrigger value="convert" className="flex-1 min-w-[60px]">转换</TabsTrigger>
                      <TabsTrigger value="img2pdf" className="flex-1 min-w-[60px]">图片</TabsTrigger>
                      <TabsTrigger value="office" className="flex-1 min-w-[60px]">Office</TabsTrigger>
                      <TabsTrigger value="ocr" className="flex-1 min-w-[60px]">OCR</TabsTrigger>
                      <TabsTrigger value="edit" className="flex-1 min-w-[60px]">编辑</TabsTrigger>
                      <TabsTrigger value="sign" className="flex-1 min-w-[60px]">签名</TabsTrigger>
                    </TabsList>
                    <Suspense fallback={<div className="flex items-center justify-center p-8 text-muted-foreground text-sm">加载中...</div>}>
                    <TabsContent value="merge">
                      <ErrorBoundary><MergePanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="split">
                      <ErrorBoundary><SplitPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="pages">
                      <ErrorBoundary><PageOperations pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="compress">
                      <ErrorBoundary><CompressPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="encrypt">
                      <ErrorBoundary><EncryptPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="watermark">
                      <ErrorBoundary><WatermarkPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="pagenum">
                      <ErrorBoundary><PageNumbersPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="convert">
                      <ErrorBoundary><ConvertPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="img2pdf">
                      <ErrorBoundary><ImagesToPdfPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="office">
                      <ErrorBoundary><ConvertOfficePanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="ocr">
                      <ErrorBoundary><OcrPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="edit">
                      <ErrorBoundary><EditPanel pdf={pdf} /></ErrorBoundary>
                    </TabsContent>
                    <TabsContent value="sign">
                      <ErrorBoundary><SignaturePanel pdf={pdf} /></ErrorBoundary>
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

      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={dismissWelcome}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -20 }}
              transition={{ type: 'spring', duration: 0.6, bounce: 0.4 }}
              className="relative bg-gradient-to-br from-pink-100 via-yellow-50 to-blue-100 dark:from-pink-950 dark:via-yellow-950 dark:to-blue-950 rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <ConfettiEffect />

              <motion.div
                animate={{ rotate: [0, 10, -10, 10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>

              <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 bg-clip-text text-transparent">
                六一儿童节快乐！
              </h2>

              <p className="text-lg mb-2 text-foreground">
                🎈 祝<span className="font-bold text-pink-500">瑶瑶宝宝</span>六一快乐 🎈
              </p>

              <p className="text-sm text-muted-foreground mb-6">
                愿你永远保持童心，快乐每一天 ✨
              </p>

              <div className="flex gap-2 justify-center mb-4">
                {['🎁', '🎀', '🌟', '🍭', '🎪'].map((emoji, i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity, repeatDelay: 1.5 }}
                    className="text-2xl"
                  >
                    {emoji}
                  </motion.span>
                ))}
              </div>

              <Button
                onClick={dismissWelcome}
                className="bg-gradient-to-r from-pink-500 to-yellow-500 hover:from-pink-600 hover:to-yellow-600 text-white font-semibold px-8"
              >
                🎊 开始使用
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
