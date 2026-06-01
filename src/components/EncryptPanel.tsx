import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Unlock, Loader2, XCircle, CheckSquare, Square, Eye, EyeOff, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useOperation } from '@/hooks/useOperation'
import { useFileSelection } from '@/hooks/useFileSelection'
import type { UsePDFReturn } from '@/hooks/usePDF'

type EncryptMode = 'encrypt' | 'decrypt'

interface EncryptPanelProps {
  pdf: UsePDFReturn
}

export function EncryptPanel({ pdf }: EncryptPanelProps) {
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } = useFileSelection(pdf.files)
  const [mode, setMode] = useState<EncryptMode>('encrypt')
  const [userPassword, setUserPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [decryptPassword, setDecryptPassword] = useState('')
  const [showUserPassword, setShowUserPassword] = useState(false)
  const [showOwnerPassword, setShowOwnerPassword] = useState(false)
  const [showDecryptPassword, setShowDecryptPassword] = useState(false)
  const [keyLength, setKeyLength] = useState<40 | 128 | 256>(256)
  const [restrictPrint, setRestrictPrint] = useState<'full' | 'low' | 'none'>('full')
  const [restrictModify, setRestrictModify] = useState<'all' | 'annotate' | 'form' | 'assembly' | 'none'>('all')
  const [restrictExtract, setRestrictExtract] = useState<'y' | 'n'>('y')
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: mode === 'encrypt' ? '加密失败' : '解密失败',
    onCancelMessage: mode === 'encrypt' ? '已取消加密操作' : '已取消解密操作',
  })

  const handleEncrypt = async () => {
    if (selectedCount === 0) return
    if (!userPassword && !ownerPassword) {
      toast.error('请至少设置用户密码或所有者密码')
      return
    }

    const fileIds = Array.from(selectedFiles)
    let successCount = 0

    const result = await execute(async (onProgress, token) => {
      for (let i = 0; i < fileIds.length; i++) {
        token.throwIfCancelled()
        setCurrentFileIndex(i)

        const fileProgress = (p: number) => {
          const overall = Math.round(((i / fileIds.length) * 100) + (p / fileIds.length))
          onProgress(overall)
        }

        const outputPath = await pdf.encryptFile(fileIds[i], {
          userPassword,
          ownerPassword: ownerPassword || undefined,
          keyLength,
          restrictions: {
            print: restrictPrint,
            modify: restrictModify,
            extract: restrictExtract,
          },
        }, fileProgress, token)
        if (outputPath) successCount++
      }
      return successCount
    })

    setCurrentFileIndex(0)

    if (result && result > 0) {
      toast.success(`加密完成！成功处理 ${result}/${fileIds.length} 个文件`)
    }
  }

  const handleDecrypt = async () => {
    if (selectedCount === 0) return
    if (!decryptPassword) {
      toast.error('请输入密码')
      return
    }

    const fileIds = Array.from(selectedFiles)
    let successCount = 0

    const result = await execute(async (onProgress, token) => {
      for (let i = 0; i < fileIds.length; i++) {
        token.throwIfCancelled()
        setCurrentFileIndex(i)

        const fileProgress = (p: number) => {
          const overall = Math.round(((i / fileIds.length) * 100) + (p / fileIds.length))
          onProgress(overall)
        }

        const outputPath = await pdf.decryptFile(fileIds[i], decryptPassword, fileProgress, token)
        if (outputPath) successCount++
      }
      return successCount
    })

    setCurrentFileIndex(0)

    if (result && result > 0) {
      toast.success(`解密完成！成功处理 ${result}/${fileIds.length} 个文件`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          PDF加密/解密
        </CardTitle>
        <CardDescription>
          给PDF添加密码保护或解除密码保护
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">请先添加PDF文件</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">选择文件</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  className="h-7 text-xs"
                >
                  {isAllSelected ? (
                    <><CheckSquare className="mr-1 h-3.5 w-3.5" />取消全选</>
                  ) : (
                    <><Square className="mr-1 h-3.5 w-3.5" />全选</>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {pdf.files.map(file => (
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
                <p className="text-xs text-muted-foreground">
                  已选择 {selectedCount} 个文件
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={mode === 'encrypt' ? 'default' : 'outline'}
                className="flex items-center gap-2"
                onClick={() => setMode('encrypt')}
              >
                <Lock className="h-4 w-4" />
                加密
              </Button>
              <Button
                variant={mode === 'decrypt' ? 'default' : 'outline'}
                className="flex items-center gap-2"
                onClick={() => setMode('decrypt')}
              >
                <Unlock className="h-4 w-4" />
                解密
              </Button>
            </div>

            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 p-4 bg-muted rounded-lg"
            >
              {mode === 'encrypt' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="userPassword">用户密码（打开文档需要）</Label>
                    <div className="relative">
                      <Input
                        id="userPassword"
                        type={showUserPassword ? 'text' : 'password'}
                        placeholder="设置用户密码"
                        value={userPassword}
                        onChange={e => setUserPassword(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowUserPassword(!showUserPassword)}
                      >
                        {showUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ownerPassword">所有者密码（修改权限需要）</Label>
                    <div className="relative">
                      <Input
                        id="ownerPassword"
                        type={showOwnerPassword ? 'text' : 'password'}
                        placeholder="设置所有者密码（可选）"
                        value={ownerPassword}
                        onChange={e => setOwnerPassword(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                      >
                        {showOwnerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>加密强度</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 256, label: 'AES-256', desc: '最强' },
                        { value: 128, label: 'AES-128', desc: '均衡' },
                        { value: 40, label: 'RC4-40', desc: '兼容' },
                      ] as const).map(opt => (
                        <Button
                          key={opt.value}
                          variant={keyLength === opt.value ? 'default' : 'outline'}
                          className="flex flex-col h-auto py-2"
                          onClick={() => setKeyLength(opt.value)}
                        >
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs opacity-80">{opt.desc}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">权限设置</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">打印</Label>
                        <Select value={restrictPrint} onValueChange={v => setRestrictPrint(v as typeof restrictPrint)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">允许打印</SelectItem>
                            <SelectItem value="low">仅低质量打印</SelectItem>
                            <SelectItem value="none">禁止打印</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">修改</Label>
                        <Select value={restrictModify} onValueChange={v => setRestrictModify(v as typeof restrictModify)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">允许修改</SelectItem>
                            <SelectItem value="annotate">仅批注</SelectItem>
                            <SelectItem value="form">仅填写表单</SelectItem>
                            <SelectItem value="assembly">仅页面组合</SelectItem>
                            <SelectItem value="none">禁止修改</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        id="restrictExtract"
                        checked={restrictExtract === 'n'}
                        onCheckedChange={checked => setRestrictExtract(checked ? 'n' : 'y')}
                      />
                      <Label htmlFor="restrictExtract" className="text-xs">禁止复制/提取内容</Label>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="decryptPassword">输入密码</Label>
                  <div className="relative">
                    <Input
                      id="decryptPassword"
                      type={showDecryptPassword ? 'text' : 'password'}
                      placeholder="输入PDF密码"
                      value={decryptPassword}
                      onChange={e => setDecryptPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowDecryptPassword(!showDecryptPassword)}
                    >
                      {showDecryptPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    输入PDF的用户密码或所有者密码以解除加密保护
                  </p>
                </div>
              )}
            </motion.div>

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">
                  {mode === 'encrypt' ? '正在加密' : '正在解密'}... {selectedCount > 1 ? `(${currentFileIndex + 1}/${selectedCount})` : ''} {progress}%
                </p>
              </motion.div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={mode === 'encrypt' ? handleEncrypt : handleDecrypt}
                disabled={selectedCount === 0 || isProcessing || (mode === 'encrypt' && !userPassword && !ownerPassword) || (mode === 'decrypt' && !decryptPassword)}
                className="flex-1"
              >
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{mode === 'encrypt' ? '加密中...' : '解密中...'}</>
                ) : (
                  <>
                    {mode === 'encrypt' ? <Lock className="mr-2 h-4 w-4" /> : <Unlock className="mr-2 h-4 w-4" />}
                    {mode === 'encrypt'
                      ? (selectedCount > 1 ? `加密 ${selectedCount} 个文件` : '开始加密')
                      : (selectedCount > 1 ? `解密 ${selectedCount} 个文件` : '开始解密')
                    }
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
