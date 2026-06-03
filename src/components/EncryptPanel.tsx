import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Lock,
  Unlock,
  Loader2,
  XCircle,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ErrorCode } from '@/lib/i18n'
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
import { Switch } from '@/components/ui/switch'
import { useOperation } from '@/hooks/useOperation'
import { useFileSelection } from '@/hooks/useFileSelection'
import type { UsePDFReturn } from '@/hooks/usePDF'

type EncryptMode = 'encrypt' | 'decrypt'

interface EncryptPanelProps {
  pdf: UsePDFReturn
}

export function EncryptPanel({ pdf }: EncryptPanelProps) {
  const { t } = useTranslation()
  const { selectedFiles, selectedCount, isAllSelected, toggleFile, toggleAll, isSelected } =
    useFileSelection(pdf.files)
  const [mode, setMode] = useState<EncryptMode>('encrypt')
  const [userPassword, setUserPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [decryptPassword, setDecryptPassword] = useState('')
  const [showUserPassword, setShowUserPassword] = useState(false)
  const [showOwnerPassword, setShowOwnerPassword] = useState(false)
  const [showDecryptPassword, setShowDecryptPassword] = useState(false)
  const [keyLength, setKeyLength] = useState<128 | 256>(256)
  const [restrictPrint, setRestrictPrint] = useState<'full' | 'low' | 'none'>('full')
  const [restrictModify, setRestrictModify] = useState<
    'all' | 'annotate' | 'form' | 'assembly' | 'none'
  >('all')
  const [restrictExtract, setRestrictExtract] = useState<'y' | 'n'>('y')
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const { isProcessing, progress, execute, cancel } = useOperation({
    errorMessagePrefix: t(mode === 'encrypt' ? 'errorPrefix.encrypt' : 'errorPrefix.decrypt'),
    onCancelMessage: t('errorPrefix.cancelled'),
  })

  const handleEncrypt = async () => {
    if (selectedCount === 0) return
    if (!userPassword && !ownerPassword) {
      toast.error(t(ErrorCode.NEED_AT_LEAST_ONE_PASSWORD))
      return
    }

    const fileIds = Array.from(selectedFiles)
    let successCount = 0

    const result = await execute(
      async (onProgress, token) => {
        for (let i = 0; i < fileIds.length; i++) {
          token.throwIfCancelled()
          setCurrentFileIndex(i)

          const fileProgress = (p: number) => {
            const overall = Math.round((i / fileIds.length) * 100 + p / fileIds.length)
            onProgress(overall)
          }

          const outputPath = await pdf.encryptFile(
            fileIds[i],
            {
              userPassword,
              ownerPassword: ownerPassword || undefined,
              keyLength,
              restrictions: {
                print: restrictPrint,
                modify: restrictModify,
                extract: restrictExtract,
              },
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
      toast.success(t('panel.encrypt.completedWithCount', { count: result, total: fileIds.length }))
    }
  }

  const handleDecrypt = async () => {
    if (selectedCount === 0) return
    if (!decryptPassword) {
      toast.error(t(ErrorCode.NEED_PASSWORD))
      return
    }

    const fileIds = Array.from(selectedFiles)
    let successCount = 0

    const result = await execute(
      async (onProgress, token) => {
        for (let i = 0; i < fileIds.length; i++) {
          token.throwIfCancelled()
          setCurrentFileIndex(i)

          const fileProgress = (p: number) => {
            const overall = Math.round((i / fileIds.length) * 100 + p / fileIds.length)
            onProgress(overall)
          }

          const outputPath = await pdf.decryptFile(fileIds[i], decryptPassword, fileProgress, token)
          if (outputPath) successCount++
        }
        return successCount
      },
      { lockFileIds: fileIds },
    )

    setCurrentFileIndex(0)

    if (result && result > 0) {
      toast.success(t('panel.encrypt.decryptCompletedWithCount', { count: result, total: fileIds.length }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {t('panel.encrypt.title')}
        </CardTitle>
        <CardDescription>{t('panel.encrypt.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdf.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('panel.encrypt.selectFile')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('panel.encrypt.selectFiles')}</label>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="mr-1 h-3.5 w-3.5" />
                      {t('fileSelection.deselectAll')}
                    </>
                  ) : (
                    <>
                      <Square className="mr-1 h-3.5 w-3.5" />
                      {t('fileSelection.selectAll')}
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
                <p className="text-xs text-muted-foreground">{t('fileSelection.selected', { count: selectedCount })}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={mode === 'encrypt' ? 'default' : 'outline'}
                className="flex items-center gap-2"
                onClick={() => setMode('encrypt')}
              >
                <Lock className="h-4 w-4" />
                {t('panel.encrypt.encryptMode')}
              </Button>
              <Button
                variant={mode === 'decrypt' ? 'default' : 'outline'}
                className="flex items-center gap-2"
                onClick={() => setMode('decrypt')}
              >
                <Unlock className="h-4 w-4" />
                {t('panel.encrypt.decryptMode')}
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
                    <Label htmlFor="userPassword">{t('panel.encrypt.userPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="userPassword"
                        type={showUserPassword ? 'text' : 'password'}
                        placeholder={t('panel.encrypt.userPasswordPlaceholder')}
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowUserPassword(!showUserPassword)}
                      >
                        {showUserPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ownerPassword">{t('panel.encrypt.ownerPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="ownerPassword"
                        type={showOwnerPassword ? 'text' : 'password'}
                        placeholder={t('panel.encrypt.ownerPasswordPlaceholder')}
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                      >
                        {showOwnerPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('panel.encrypt.keyLength')}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { value: 256, label: 'AES-256', desc: t('panel.encrypt.recommended') },
                          { value: 128, label: 'AES-128', desc: t('panel.encrypt.notRecommended') },
                        ] as const
                      ).map((opt) => (
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
                      <span className="text-sm font-medium">{t('panel.encrypt.restrictions')}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('panel.encrypt.print')}</Label>
                        <Select
                          value={restrictPrint}
                          onValueChange={(v) => setRestrictPrint(v as typeof restrictPrint)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">{t('panel.encrypt.allowPrint')}</SelectItem>
                            <SelectItem value="low">{t('panel.encrypt.allowPrintLow')}</SelectItem>
                            <SelectItem value="none">{t('panel.encrypt.disallowPrint')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('panel.encrypt.modify')}</Label>
                        <Select
                          value={restrictModify}
                          onValueChange={(v) => setRestrictModify(v as typeof restrictModify)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t('panel.encrypt.allowModify')}</SelectItem>
                            <SelectItem value="annotate">{t('panel.encrypt.allowAnnotate')}</SelectItem>
                            <SelectItem value="form">{t('panel.encrypt.formOnly')}</SelectItem>
                            <SelectItem value="assembly">{t('panel.encrypt.assemblyOnly')}</SelectItem>
                            <SelectItem value="none">{t('panel.encrypt.disallowModify')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        id="restrictExtract"
                        checked={restrictExtract === 'n'}
                        onCheckedChange={(checked) => setRestrictExtract(checked ? 'n' : 'y')}
                      />
                      <Label htmlFor="restrictExtract" className="text-xs">
                        {t('panel.encrypt.disallowCopy')}
                      </Label>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="decryptPassword">{t('panel.encrypt.decryptPasswordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="decryptPassword"
                      type={showDecryptPassword ? 'text' : 'password'}
                      placeholder={t('panel.encrypt.decryptPasswordPlaceholder')}
                      value={decryptPassword}
                      onChange={(e) => setDecryptPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowDecryptPassword(!showDecryptPassword)}
                    >
                      {showDecryptPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('panel.encrypt.decryptHint')}
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
                  {mode === 'encrypt' ? t('panel.encrypt.encrypting') : t('panel.encrypt.decrypting')}...{' '}
                  {selectedCount > 1 ? `(${currentFileIndex + 1}/${selectedCount})` : ''} {progress}
                  %
                </p>
              </motion.div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={mode === 'encrypt' ? handleEncrypt : handleDecrypt}
                disabled={
                  selectedCount === 0 ||
                  isProcessing ||
                  (mode === 'encrypt' && !userPassword && !ownerPassword) ||
                  (mode === 'decrypt' && !decryptPassword)
                }
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'encrypt' ? t('panel.encrypt.encryptingProgress') : t('panel.encrypt.decryptingProgress')}
                  </>
                ) : (
                  <>
                    {mode === 'encrypt' ? (
                      <Lock className="mr-2 h-4 w-4" />
                    ) : (
                      <Unlock className="mr-2 h-4 w-4" />
                    )}
                    {mode === 'encrypt'
                      ? selectedCount > 1
                        ? t('panel.encrypt.encryptFiles', { count: selectedCount })
                        : t('panel.encrypt.startEncrypt')
                      : selectedCount > 1
                        ? t('panel.encrypt.decryptFiles', { count: selectedCount })
                        : t('panel.encrypt.startDecrypt')}
                  </>
                )}
              </Button>
              {isProcessing && (
                <Button variant="outline" onClick={cancel}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('panel.encrypt.cancel')}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
