import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { Pen, Upload, Loader2, RotateCcw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import type { UsePDFReturn } from '@/hooks/usePDF'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import { getPdfjsLib, PDFJS_CONFIG } from '@/lib/pdfjs-config'
import { logger } from '@/lib/logger'

interface SignaturePanelProps {
  pdf: UsePDFReturn
}

export function SignaturePanel({ pdf }: SignaturePanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState<'draw' | 'position'>('draw')
  const [signPos, setSignPos] = useState({ x: 300, y: 100 })
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 })
  const [signWidth, setSignWidth] = useState(150)
  const [pageThumbnail, setPageThumbnail] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedFileData = pdf.files.find(f => f.id === selectedFile)

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
    const file = pdf.files.find(f => f.id === selectedFile)
    if (!file) return
    const pdfjsLib = getPdfjsLib()
    pdfjsLib.getDocument({ data: new Uint8Array(file.data), ...PDFJS_CONFIG }).promise.then(async pdfDoc => {
      try {
        const page = await pdfDoc.getPage(pageIndex + 1)
        const viewport = page.getViewport({ scale: 1 })
        setPageSize({ width: viewport.width, height: viewport.height })
        const thumb = await pdf.getPageThumbnail(selectedFile, pageIndex, 800)
        setPageThumbnail(thumb)
      } finally {
        pdfDoc.destroy()
      }
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('password') || msg.includes('encrypt')) {
        toast.error('PDF文件已加密，无法预览')
      } else {
        logger.warn(`PDF预览加载失败(${file.name}): ${msg}`)
      }
    })
  }, [selectedFile, pdf.files, pageIndex, pdf])

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

  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
  }, [getCanvasPos])

  const lastDrawCallRef = useRef(0)
  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
  }, [isDrawing, getCanvasPos])

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
      toast.error('签名画布未就绪')
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      toast.error('签名画布上下文不可用')
      return
    }
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const hasContent = pixelData.some(pixel => pixel !== 0)
    if (!hasContent) {
      toast.error('请先绘制签名')
      return
    }
    const dataUrl = canvas.toDataURL('image/png')
    setSignatureDataUrl(dataUrl)
    setStep('position')
  }, [])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 校验图片格式
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('仅支持PNG/JPG格式的签名图片')
      return
    }
    // 校验文件大小不超过5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('签名图片大小不能超过5MB')
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
        toast.error('文件不是有效的PNG/JPG图片，请重新选择')
        return
      }
      // 加载图片并校验是否能正常解码
      const img = new Image()
      img.onload = () => {
        setSignatureDataUrl(reader.result as string)
        setStep('position')
      }
      img.onerror = () => {
        toast.error('图片解码失败，请选择有效的图片文件')
      }
      img.src = reader.result as string
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'position' || isDragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const relY = (e.clientY - rect.top) / rect.height
    setSignPos({ x: relX * pageSize.width, y: (1 - relY) * pageSize.height })
  }, [step, pageSize, isDragging])

  const handleSignMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handlePageMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || step !== 'position') return
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const relY = (e.clientY - rect.top) / rect.height
    setSignPos({ x: relX * pageSize.width, y: (1 - relY) * pageSize.height })
  }, [isDragging, step, pageSize])

  const handlePageMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleSign = useCallback(async () => {
    if (!selectedFile || !signatureDataUrl) return
    const token = createCancellationToken()
    setIsProcessing(true)
    setProgress(0)
    try {
      const signHeight = signWidth * 0.5
      // 校验签名尺寸范围
      if (signWidth < 50 || signWidth > Math.min(pageSize.width, 800)) {
        toast.error('签名宽度需在50px到页面宽度之间')
        setIsProcessing(false)
        return
      }
      if (signHeight < 25 || signHeight > Math.min(pageSize.height, 400)) {
        toast.error('签名高度需在25px到页面高度之间')
        setIsProcessing(false)
        return
      }
      // 校验签名位置边界
      if (signPos.x < 0 || signPos.y < 0 || 
          signPos.x + signWidth > pageSize.width || 
          signPos.y + signHeight > pageSize.height) {
        toast.error('签名超出页面范围，请调整位置或缩小签名尺寸')
        setIsProcessing(false)
        return
      }
      const outputPath = await pdf.addSignature(
        selectedFile,
        signatureDataUrl,
        { pageIndex, x: signPos.x, y: signPos.y, width: signWidth, height: signHeight },
        p => setProgress(p),
        token
      )
      if (outputPath) {
        toast.success('签名完成！')
        setStep('draw')
        setSignatureDataUrl(null)
        clearCanvas()
      }
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info('操作已取消')
      } else {
        toast.error(`签名失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setIsProcessing(false)
    }
  }, [selectedFile, signatureDataUrl, pageIndex, signPos, signWidth, pageSize.width, pageSize.height, pdf, clearCanvas])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pen className="h-5 w-5" />
          电子签名
        </CardTitle>
        <CardDescription>
          手绘签名或上传签名图片，嵌入到PDF文档中
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">请先添加PDF文件</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>选择文件</Label>
              <div className="flex flex-wrap gap-2">
                {pdf.files.map(file => (
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
                <Label>选择页码</Label>
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
                <Label>请在下方手绘签名</Label>
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
                    在此处绘制您的签名
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearCanvas}>
                    <RotateCcw className="mr-1 h-3 w-3" />
                    清除
                  </Button>
                  <Button size="sm" onClick={confirmSignature}>
                    <Check className="mr-1 h-3 w-3" />
                    确认签名
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    上传图片
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
                    <Label>点击或拖拽调整签名位置</Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">签名宽度:</Label>
                      <input
                        type="range"
                        min="80"
                        max="300"
                        value={signWidth}
                        onChange={e => setSignWidth(Number(e.target.value))}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground w-10">{signWidth}px</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">💡 直接拖拽签名可以调整位置，拖动滑块调整大小</p>
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
                      alt="页面预览"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                      加载页面预览中...
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
                      alt="签名预览"
                      className="w-full h-auto border border-dashed border-blue-400 bg-white/50"
                      style={{ userSelect: 'none' }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setStep('draw'); setSignatureDataUrl(null) }}>
                    重新签名
                  </Button>
                  <Button size="sm" onClick={handleSign} disabled={isProcessing}>
                    {isProcessing ? (
                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" />处理中...</>
                    ) : (
                      <><Check className="mr-1 h-3 w-3" />确认签署</>
                    )}
                  </Button>
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
