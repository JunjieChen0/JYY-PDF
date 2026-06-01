import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Edit3, Type, Square, Circle, Highlighter, Loader2, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UsePDFReturn } from '@/hooks/usePDF'
import type { Annotation } from '@/hooks/types'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import { getPdfjsLib, PDFJS_CONFIG } from '@/lib/pdfjs-config'
import { logger } from '@/lib/logger'

interface EditPanelProps {
  pdf: UsePDFReturn
}

const TOOL_TYPES = [
  { value: 'text', label: '文字', icon: Type },
  { value: 'rect', label: '矩形', icon: Square },
  { value: 'circle', label: '圆形', icon: Circle },
  { value: 'highlight', label: '高亮', icon: Highlighter },
] as const

export function EditPanel({ pdf }: EditPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [tool, setTool] = useState<Annotation['type']>('text')
  const [text, setText] = useState('标注文字')
  const [color, setColor] = useState('#ff0000')
  const [fontSize, setFontSize] = useState(16)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

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

  const addAnnotation = async () => {
    if (!selectedFileData) return
    try {
      const pdfjsLib = getPdfjsLib()
      const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(selectedFileData.data), ...PDFJS_CONFIG }).promise
      const page = await pdfDoc.getPage(pageIndex + 1)
      const { width, height } = page.getViewport({ scale: 1 })
      pdfDoc.destroy()
      
      const centerX = width / 2 - 50
      const centerY = height / 2 - 40
      const base = { pageIndex, color, x: centerX, y: centerY }
      const ann: Annotation = tool === 'text'
        ? { ...base, type: 'text', text, fontSize }
        : tool === 'highlight'
        ? { ...base, type: 'highlight', width: 150, height: 20, opacity: 0.3 }
        : { ...base, type: tool, width: 100, height: 80 }
      setAnnotations(prev => [...prev, ann])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('password') || msg.includes('encrypt')) {
        toast.error('PDF文件已加密，无法编辑')
      } else {
        logger.warn(`编辑面板页面加载失败: ${msg}`)
        toast.error('获取页面尺寸失败，请检查PDF是否有效')
      }
    }
  }

  const removeAnnotation = (index: number) => {
    setAnnotations(prev => prev.filter((_, i) => i !== index))
  }

  const clearAnnotations = () => setAnnotations([])

  const handleSave = async () => {
    if (!selectedFile || annotations.length === 0) {
      toast.error('请先添加标注')
      return
    }
    const token = createCancellationToken()
    setIsProcessing(true)
    setProgress(0)
    try {
      const outputPath = await pdf.addAnnotation(
        selectedFile,
        annotations,
        p => setProgress(p),
        token
      )
      if (outputPath) {
        toast.success('编辑保存成功！')
        setAnnotations([])
      }
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info('操作已取消')
      } else {
        toast.error(`保存失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="h-5 w-5" />
          PDF编辑
        </CardTitle>
        <CardDescription>
          在PDF上添加文字、矩形、圆形、高亮等标注
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

            <div className="space-y-2">
              <Label>工具类型</Label>
              <div className="flex gap-2">
                {TOOL_TYPES.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={tool === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTool(value)}
                  >
                    <Icon className="mr-1 h-3 w-3" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {tool === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="ann-text">文字内容</Label>
                <Input
                  id="ann-text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="输入标注文字"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>颜色</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <span className="text-sm text-muted-foreground">{color}</span>
                </div>
              </div>
              {tool === 'text' && (
                <div className="space-y-2">
                  <Label>字号</Label>
                  <Input
                    type="number"
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    min={8}
                    max={72}
                  />
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={addAnnotation} className="w-full">
              <Plus className="mr-1 h-3 w-3" />
              添加标注到第 {pageIndex + 1} 页
            </Button>

            {annotations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>标注列表 ({annotations.length})</Label>
                  <Button variant="ghost" size="sm" onClick={clearAnnotations}>
                    <Trash2 className="mr-1 h-3 w-3" />
                    清空
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {annotations.map((ann, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                      <span>
                        {TOOL_TYPES.find(t => t.value === ann.type)?.label}
                        {ann.text ? `: ${ann.text}` : ''}
                        <span className="text-muted-foreground ml-2">第{ann.pageIndex + 1}页</span>
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAnnotation(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={isProcessing || annotations.length === 0}
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</>
              ) : (
                <><Edit3 className="mr-2 h-4 w-4" />保存编辑</>
              )}
            </Button>

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
