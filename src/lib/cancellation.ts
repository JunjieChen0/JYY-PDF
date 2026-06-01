export class CancellationToken {
  private _isCancelled = false
  private _listeners: (() => void)[] = []

  get isCancelled(): boolean {
    return this._isCancelled
  }

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

  throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new CancelledError('操作已取消')
    }
  }

  onCancel(callback: () => void): void {
    if (this._isCancelled) {
      callback()
    } else {
      this._listeners.push(callback)
    }
  }
}

export class CancelledError extends Error {
  constructor(message: string = '操作已取消') {
    super(message)
    this.name = 'CancelledError'
  }
}

export function createCancellationToken(): CancellationToken {
  return new CancellationToken()
}
