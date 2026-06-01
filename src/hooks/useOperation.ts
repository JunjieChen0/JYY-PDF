import { useState, useCallback, useRef } from 'react'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import type { CancellationToken } from '@/lib/cancellation'
import { toast } from 'sonner'

interface UseOperationOptions {
  onCancelMessage?: string
  errorMessagePrefix?: string
}

export function useOperation(options?: UseOperationOptions) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const tokenRef = useRef<CancellationToken | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const execute = useCallback(async <T>(
    operation: (onProgress: (p: number) => void, token: CancellationToken) => Promise<T>
  ): Promise<T | null> => {
    const token = createCancellationToken()
    tokenRef.current = token
    setIsProcessing(true)
    setProgress(0)

    try {
      const result = await operation(setProgress, token)
      return result
    } catch (error) {
      if (error instanceof CancelledError) {
        toast.info(optionsRef.current?.onCancelMessage || '操作已取消')
      } else {
        const prefix = optionsRef.current?.errorMessagePrefix || '操作失败'
        toast.error(`${prefix}：${error instanceof Error ? error.message : String(error)}`)
      }
      return null
    } finally {
      setIsProcessing(false)
      setProgress(0)
      tokenRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    tokenRef.current?.cancel()
  }, [])

  return { isProcessing, progress, execute, cancel, setProgress }
}
