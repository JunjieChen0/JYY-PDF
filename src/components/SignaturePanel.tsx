import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { Pen, Upload, Loader2, RotateCcw, Check, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import type { UsePDFReturn } from '@/hooks/usePDF'
import { useOperation } from '@/hooks/useOperation'
import { getPdfjsLib, PDFJS_CONFIG } from '@/lib/pdfjs-config'
import { logger } from '@/lib/logger'
import * as pdfDataStore from '@/lib/pdf-data-store'
import { getRequiredPdfData } from '@/lib/pdf-helpers'
import { ErrorCode } from '@/lib/i18n'

interface SignaturePanelProps {
  pdf: UsePDFReturn
}

export function SignaturePanel({ pdf }: SignaturePanelProps) {
  const { t } = useTranslation()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t('errorPrefix.signature'),
    onCancelMessage: t('panel.edit.operationCancelled'),
  })
  const [step, setStep] = useState<'draw' | 'position'>('draw')
  const [signPos, setSignPos] = useState({ x: 300, y: 100 })
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 })
  const [signWidth, setSignWidth] = useState(150)
  const [pageThumbnail, setPageThumbnail] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedFileData = pdf.files.find((f) => f.id === selectedFile)

  useEffect(() => {
    if (!selectedFile && pdf.files.length > 0) {
      setSelectedFile(pdf.files[0].id)
    }
  }, [pdf.files, selectedFile])

  useEffect(() => {
    if (selectedFileData && pageIndex >= selectedFileData.pageCount) {
      setPageIndex(0)
    }
  }, [selectedFile, selectedFileData, pageIndex])

  useEffect(() => {
    if (!selectedFile) return
    const file = pdf.files.find((f) => f.id === selectedFile)
    if (!file) return
    let cancelled = false
    const pdfjsLib = getPdfjsLib()
    const fileData = getRequiredPdfData(file.id, pdfDataStore)
    pdfjsLib
      .getDocument({ data: new Uint8Array(fileData), ...PDFJS_CONFIG })
      .promise.then(async (pdfDoc) => {
        try {
          const page = await pdfDoc.getPage(pageIndex + 1)
          const viewport = page.getViewport({ scale: 1 })
          if (!cancelled) {
            setPageSize({ width: viewport.width, height: viewport.height })
            const thumb = await pdf.getPageThumbnail(selectedFile, pageIndex, 800)
            if (!cancelled) setPageThumbnail(thumb)
          }
        } finally {
          pdfDoc.destroy()
        }
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('password') || msg.includes('encrypt')) {
          toast.error(t(ErrorCode.PDF_ENCRYPTED_CANNOT_PREVIEW))
        } else {
          logger.warn(`PDF preview load failed (${file.name}): ${msg}`)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, pdf.files, pageIndex, pdf.getPageThumbnail])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [step])

  const getCanvasPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
    },
    [],
  )

  const startDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDrawing(true)
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { x, y } = getCanvasPos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    },
    [getCanvasPos],
  )

  const lastDrawCallRef = useRef(0)
  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return
      const now = Date.now()
      if (now - lastDrawCallRef.current < 16) return
      lastDrawCallRef.current = now
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { x, y } = getCanvasPos(e)
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(x, y)
      ctx.stroke()
    },
    [isDrawing, getCanvasPos],
  )

  const endDraw = useCallback(() => setIsDrawing(false), [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureDataUrl(null)
  }, [])

  const confirmSignature = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      toast.error(t(ErrorCode.SIGNATURE_CANVAS_NOT_READY))
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      toast.error(t(ErrorCode.SIGNATURE_CONTEXT_UNAVAILABLE))
      return
    }
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const hasContent = pixelData.some((pixel) => pixel !== 0)
    if (!hasContent) {
      toast.error(t(ErrorCode.SIGNATURE_NOT_DRAWN))
      return
    }
    const dataUrl = canvas.toDataURL('image/png')
    setSignatureDataUrl(dataUrl)
    setStep('position')
  }, [t])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 校验图片格式
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error(t(ErrorCode.SIGNATURE_FORMAT_PNG_JPG))
      return
    }
    // 校验文件大小不超过5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t(ErrorCode.SIGNATURE_IMAGE_TOO_LARGE))
      return
    }
    // 校验文件魔数，防止恶意文件伪装成图片
    const reader = new FileReader()
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer).subarray(0, 4)
      let header = ''
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16)
      }
      // PNG: 89504e47, JPG: ffd8ffe0/ffd8ffe1/ffd8ffee
      if (!header.startsWith('89504e47') && !header.startsWith('ffd8ff')) {
        toast.error(t(ErrorCode.SIGNATURE_INVALID_IMAGE))
        return
      }
      // 加载图片并校验是否能正常解码
      const img = new Image()
      img.onload = () => {
        setSignatureDataUrl(reader.result as string)
        setStep('position')
      }
      img.onerror = () => {
        toast.error(t(ErrorCode.SIGNATURE_DECODE_FAILED))
      }
      img.src = reader.result as string
    }
    reader.readAsArrayBuffer(file)
  }, [t])

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (step !== 'position' || isDragging) return
      const rect = e.currentTarget.getBoundingClientRect()
      const relX = (e.clientX - rect.left) / rect.width
      const relY = (e.clientY - rect.top) / rect.height
      setSignPos({ x: relX * pageSize.width, y: (1 - relY) * pageSize.height })
    },
    [step, pageSize, isDragging],
  )

  const handleSignMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handlePageMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging || step !== 'position') return
      const rect = e.currentTarget.getBoundingClientRect()
      const relX = (e.clientX - rect.left) / rect.width
      const relY = (e.clientY - rect.top) / rect.height
      setSignPos({ x: relX * pageSize.width, y: (1 - relY) * pageSize.height })
    },
    [isDragging, step, pageSize],
  )

  const handlePageMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleSign = useCallback(async () => {
    if (!selectedFile || !signatureDataUrl) return
    const signHeight = signWidth * 0.5
    if (signWidth < 50 || signWidth > Math.min(pageSize.width, 800)) {
      toast.error(t(ErrorCode.SIGNATURE_WIDTH_OUT_OF_RANGE))
      return
    }
    if (signHeight < 25 || signHeight > Math.min(pageSize.height, 400)) {
      toast.error(t(ErrorCode.SIGNATURE_HEIGHT_OUT_OF_RANGE))
      return
    }
    if (
      signPos.x < 0 ||
      signPos.y < 0 ||
      signPos.x + signWidth > pageSize.width ||
      signPos.y + signHeight > pageSize.height
    ) {
      toast.error(t(ErrorCode.SIGNATURE_OUT_OF_PAGE))
      return
    }

    const outputPath = await execute(
      async (onProgress, token) => {
        return pdf.addSignature(
          selectedFile,
          signatureDataUrl,
          { pageIndex, x: signPos.x, y: signPos.y, width: signWidth, height: signHeight },
          onProgress,
          token,
        )
      },
      { lockFileIds: selectedFile ? [selectedFile] : undefined },
    )

    if (outputPath) {
      toast.success(t('panel.signature.completed'))
      setStep('draw')
      setSignatureDataUrl(null)
      clearCanvas()
    }
  }, [
    selectedFile,
    signatureDataUrl,
    pageIndex,
    signPos,
    signWidth,
    pageSize.width,
    pageSize.height,
    pdf,
    clearCanvas,
    execute,
    t,
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pen className="h-5 w-5" />
          {t('panel.signature.title')}
        </CardTitle>
        <CardDescription>{t('panel.signature.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('panel.signature.selectFileHint')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{t('panel.signature.selectFileLabel')}</Label>
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

            {selectedFileData && selectedFileData.pageCount > 1 && (
              <div className="space-y-2">
                <Label>{t('panel.signature.selectPageLabel')}</Label>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: selectedFileData.pageCount }, (_, i) => (
                    <Badge
                      key={i}
                      variant={pageIndex === i ? 'default' : 'outline'}
                      className="cursor-pointer min-w-[32px] justify-center"
                      onClick={() => setPageIndex(i)}
                    >
                      {i + 1}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {step === 'draw' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <Label>{t('panel.signature.drawHint')}</Label>
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="border rounded-lg cursor-crosshair bg-white w-full"
                    style={{ touchAction: 'none' }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none opacity-50">
                    {t('panel.signature.drawHere')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearCanvas}>
                    <RotateCcw className="mr-1 h-3 w-3" />
                    {t('panel.signature.clear')}
                  </Button>
                  <Button size="sm" onClick={confirmSignature}>
                    <Check className="mr-1 h-3 w-3" />
                    {t('panel.signature.confirm')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-1 h-3 w-3" />
                    {t('panel.signature.uploadSignature')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </motion.div>
            )}

            {step === 'position' && signatureDataUrl && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('panel.signature.dragToPosition')}</Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">{t('panel.signature.signatureWidth')}</Label>
                      <input
                        type="range"
                        min="80"
                        max="300"
                        value={signWidth}
                        onChange={(e) => setSignWidth(Number(e.target.value))}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground w-10">{signWidth}px</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 {t('panel.signature.dragHint')}
                  </p>
                </div>
                <div
                  className="relative border rounded-lg overflow-hidden cursor-crosshair bg-white"
                  style={{ aspectRatio: `${pageSize.width}/${pageSize.height}` }}
                  onClick={handlePageClick}
                  onMouseMove={handlePageMouseMove}
                  onMouseUp={handlePageMouseUp}
                  onMouseLeave={handlePageMouseUp}
                >
                  {pageThumbnail ? (
                    <img
                      src={pageThumbnail}
                      alt={t('panel.signature.pagePreview')}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                      {t('panel.signature.loadingPreview')}
                    </div>
                  )}
                  <div
                    className={`absolute cursor-move transition-shadow ${isDragging ? 'shadow-lg shadow-blue-500/50' : ''}`}
                    style={{
                      left: `${(signPos.x / pageSize.width) * 100}%`,
                      bottom: `${(signPos.y / pageSize.height) * 100}%`,
                      transform: 'translate(-50%, 0)',
                      width: `${(signWidth / pageSize.width) * 100}%`,
                    }}
                    onMouseDown={handleSignMouseDown}
                  >
                    <img
                      src={signatureDataUrl}
                      alt={t('panel.signature.signaturePreview')}
                      className="w-full h-auto border border-dashed border-blue-400 bg-white/50"
                      style={{ userSelect: 'none' }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStep('draw')
                      setSignatureDataUrl(null)
                    }}
                  >
                    {t('panel.signature.resign')}
                  </Button>
                  <Button size="sm" onClick={handleSign} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {t('panel.signature.processing')}
                      </>
                    ) : (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        {t('panel.signature.confirmSign')}
                      </>
                    )}
                  </Button>
                  {isProcessing && (
                    <Button variant="outline" size="sm" onClick={cancel}>
                      <XCircle className="mr-1 h-3 w-3" />
                      {t('panel.signature.cancel')}
                    </Button>
                  )}
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
                <p className="text-sm text-muted-foreground text-center">{progress}%</p>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
