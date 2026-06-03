import { useState } from 'react'
import { motion } from 'framer-motion'
import { ImageIcon, Type, Loader2, Upload, XCircle, CheckSquare, Square } from 'lucide-react'
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

interface WatermarkPanelProps {
  pdf: UsePDFReturn
}

export function WatermarkPanel({ pdf }: WatermarkPanelProps) {
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } =
    useFileSelection(pdf.files)
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text')
  const [textContent, setTextContent] = useState('水印')
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [position, setPosition] = useState<
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'center'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
    | 'tile'
  >('tile')
  const [opacity, setOpacity] = useState(30)
  const [fontSize, setFontSize] = useState(60)
  const [rotate, setRotate] = useState(-45)
  const [color, setColor] = useState('#999999')
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: '添加水印失败',
    onCancelMessage: '操作已取消',
  })

  const handleSelectImage = async () => {
    const result = await window.electronAPI.openFile({
      defaultPath: '',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg'] }],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const ext = filePath.toLowerCase().split('.').pop()
      if (!['png', 'jpg', 'jpeg'].includes(ext || '')) {
        toast.warning('请选择 PNG 或 JPG 格式的图片文件')
        return
      }
      setImagePath(filePath)
      const parts = filePath.replace(/\\/g, '/').split('/')
      setImageName(parts[parts.length - 1])
    }
  }

  const handleAddWatermark = async () => {
    if (selectedCount === 0) return
    if (watermarkType === 'image' && !imagePath) {
      toast.warning('请先选择水印图片')
      return
    }

    const fileIds = Array.from(selectedFiles)

    const result = await execute(
      async (onProgress, token) => {
        let successCount = 0
        for (let i = 0; i < fileIds.length; i++) {
          token.throwIfCancelled()
          setCurrentFileIndex(i)

          const fileProgress = (p: number) => {
            const overall = Math.round((i / fileIds.length) * 100 + p / fileIds.length)
            onProgress(overall)
          }

          const outputPath = await pdf.addWatermark(
            fileIds[i],
            {
              type: watermarkType,
              content: textContent,
              imagePath: imagePath || undefined,
              position,
              opacity: opacity / 100,
              fontSize,
              rotate,
              color,
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
      toast.success(`水印添加完成！成功处理 ${result}/${fileIds.length} 个文件`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          添加水印
        </CardTitle>
        <CardDescription>给PDF添加文字或图片水印</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">请先添加PDF文件</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">选择文件</label>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="mr-1 h-3.5 w-3.5" />
                      取消全选
                    </>
                  ) : (
                    <>
                      <Square className="mr-1 h-3.5 w-3.5" />
                      全选
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
                <p className="text-xs text-muted-foreground">已选择 {selectedCount} 个文件</p>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 p-4 bg-muted rounded-lg"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">水印类型</label>
                <div className="flex gap-2">
                  <Button
                    variant={watermarkType === 'text' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setWatermarkType('text')}
                  >
                    <Type className="mr-2 h-4 w-4" />
                    文字水印
                  </Button>
                  <Button
                    variant={watermarkType === 'image' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setWatermarkType('image')}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    图片水印
                  </Button>
                </div>
              </div>

              {watermarkType === 'text' && (
                <div className="space-y-2">
                  <Label htmlFor="textContent">水印文字</Label>
                  <Input
                    id="textContent"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="请输入水印文字"
                  />
                </div>
              )}

              {watermarkType === 'image' && (
                <div className="space-y-2">
                  <Label>水印图片</Label>
                  <div
                    onClick={handleSelectImage}
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  >
                    {imageName ? (
                      <div className="flex items-center justify-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <span className="text-sm">{imageName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setImagePath(null)
                            setImageName('')
                          }}
                        >
                          移除
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">点击选择图片（PNG/JPG）</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>位置</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as typeof position)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">左上</SelectItem>
                    <SelectItem value="top-center">上中</SelectItem>
                    <SelectItem value="top-right">右上</SelectItem>
                    <SelectItem value="center">居中</SelectItem>
                    <SelectItem value="bottom-left">左下</SelectItem>
                    <SelectItem value="bottom-center">下中</SelectItem>
                    <SelectItem value="bottom-right">右下</SelectItem>
                    <SelectItem value="tile">平铺满页</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>透明度: {opacity}%</Label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {watermarkType === 'text' && (
                <>
                  <div className="space-y-2">
                    <Label>字体大小: {fontSize}px</Label>
                    <input
                      type="range"
                      min="20"
                      max="120"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="color">颜色</Label>
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
                </>
              )}

              <div className="space-y-2">
                <Label>旋转角度: {rotate}°</Label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={rotate}
                  onChange={(e) => setRotate(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddWatermark}
                  disabled={
                    selectedCount === 0 || isProcessing || (watermarkType === 'image' && !imagePath)
                  }
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      添加中...
                    </>
                  ) : (
                    <>
                      <Type className="mr-2 h-4 w-4" />
                      {selectedCount > 1 ? `添加水印 (${selectedCount} 个文件)` : '添加水印'}
                    </>
                  )}
                </Button>
                {isProcessing && (
                  <Button variant="outline" onClick={cancel}>
                    <XCircle className="mr-2 h-4 w-4" />
                    取消
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
                  正在添加水印...{' '}
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
