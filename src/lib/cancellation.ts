/**
 * 可取消操作的令牌。
 *
 * 设计目标：为长时间运行的 PDF 操作（合并、压缩、签名等）提供取消机制。
 * - 令牌一旦取消不可恢复（单向状态转换）
 * - 监听器在取消时同步执行，执行错误不影响其他监听器
 * - 取消后注册的监听器会立即同步执行
 */
export class CancellationToken {
  private _isCancelled = false
  private _listeners: (() => void)[] = []

  /** 当前是否已取消 */
  get isCancelled(): boolean {
    return this._isCancelled
  }

  /** 取消操作。已取消时重复调用是 no-op */
  cancel(): void {
    if (this._isCancelled) return
    this._isCancelled = true
    const listeners = [...this._listeners]
    this._listeners = []
    for (const listener of listeners) {
      try {
        listener()
      } catch {
        // 忽略监听器中的错误，确保所有监听器都能执行
      }
    }
  }

  /**
   * 若已取消则抛出 {@link CancelledError}。
   * 应在操作循环的关键节点调用以实现协作式取消。
   * @throws {CancelledError}
   */
  throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new CancelledError('操作已取消')
    }
  }

  /**
   * 注册取消回调。若已取消则立即同步执行。
   * @param callback - 取消时执行的回调
   */
  onCancel(callback: () => void): void {
    if (this._isCancelled) {
      callback()
    } else {
      this._listeners.push(callback)
    }
  }
}

/**
 * 取消操作时抛出的错误类型。
 * 用于在 `useOperation` 中区分普通错误与用户主动取消。
 */
export class CancelledError extends Error {
  constructor(message: string = '操作已取消') {
    super(message)
    this.name = 'CancelledError'
  }
}

/**
 * 创建一个新的 {@link CancellationToken} 实例。
 * @returns 空令牌（未取消状态）
 */
export function createCancellationToken(): CancellationToken {
  return new CancellationToken()
}
