import { useState, useCallback, useRef } from 'react'
import { createCancellationToken, CancelledError } from '@/lib/cancellation'
import type { CancellationToken } from '@/lib/cancellation'
import { toast } from 'sonner'
import { acquireOperation, releaseOperation } from '@/lib/operation-counter'
import { acquireFileLocks, releaseFileLocks } from '@/lib/operation-lock'
import { t, ErrorCode } from '@/lib/i18n'

/**
 * useOperation 的全局配置（按组件实例）。
 */
export interface UseOperationOptions {
  /** 用户点击取消时 toast 的文案 */
  onCancelMessage?: string
  /** 抛错时 toast 的前缀（如 `'压缩失败'`） */
  errorMessagePrefix?: string
  /** 命中 operation-lock 时 toast 的文案（与 ExecuteOptions.lockFileIds 配合使用） */
  onLockedMessage?: string
}

/**
 * useOperation.execute 的每次调用级配置。
 */
export interface ExecuteOptions {
  /**
   * 本次操作要锁定的文件 ID 列表。任意 ID 已被其他操作占用时直接 toast 拒绝并返回 null。
   * 同组件实例下重复 execute 默认会因重入守卫而拒绝（无需 lockFileIds）。
   */
  lockFileIds?: string[]
}

export function useOperation(options?: UseOperationOptions) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const tokenRef = useRef<CancellationToken | null>(null)
  const inFlightRef = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const execute = useCallback(
    async <T>(
      operation: (onProgress: (p: number) => void, token: CancellationToken) => Promise<T>,
      execOptions: ExecuteOptions = {},
    ): Promise<T | null> => {
      if (inFlightRef.current) {
        return null
      }
      inFlightRef.current = true

      const lockIds = execOptions.lockFileIds ?? []
      acquireOperation()
      if (lockIds.length > 0 && !acquireFileLocks(lockIds)) {
        releaseOperation()
        inFlightRef.current = false
        toast.error(
          optionsRef.current?.onLockedMessage ||
            t('errorPrefix.cancelled') + '：该文件正在被其他操作处理，请稍候再试',
        )
        return null
      }

      const token = createCancellationToken()
      tokenRef.current = token
      setIsProcessing(true)
      setProgress(0)

      try {
        const result = await operation(setProgress, token)
        return result
      } catch (error) {
        if (error instanceof CancelledError) {
          toast.info(optionsRef.current?.onCancelMessage || t(ErrorCode.CANCELLED))
        } else {
          const prefix = optionsRef.current?.errorMessagePrefix || t(ErrorCode.OPERATION_FAILED)
          toast.error(`${prefix}：${error instanceof Error ? error.message : String(error)}`)
        }
        return null
      } finally {
        setIsProcessing(false)
        setProgress(0)
        tokenRef.current = null
        releaseOperation()
        if (lockIds.length > 0) {
          releaseFileLocks(lockIds)
        }
        inFlightRef.current = false
      }
    },
    [],
  )

  const cancel = useCallback(() => {
    tokenRef.current?.cancel()
  }, [])

  return { isProcessing, progress, execute, cancel, setProgress }
}
