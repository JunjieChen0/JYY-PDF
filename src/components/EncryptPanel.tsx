import { motion } from 'framer-motion'
import { Lock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { UsePDFReturn } from '@/hooks/usePDF'

interface EncryptPanelProps {
  pdf: UsePDFReturn
}

export function EncryptPanel(_props: EncryptPanelProps) {
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 p-6 text-center"
        >
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg w-full">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-left text-amber-800 dark:text-amber-200">
              <p className="font-semibold mb-1">功能暂不可用</p>
              <p className="text-amber-600 dark:text-amber-300">
                当前使用的 PDF 库（pdf-lib）不支持加密/解密操作。
                请使用其他专业 PDF 工具（如 Adobe Acrobat）进行加密处理。
              </p>
            </div>
          </div>
          <Button variant="outline" disabled className="mt-2">
            <Lock className="mr-2 h-4 w-4" />
            加密/解密（不可用）
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  )
}