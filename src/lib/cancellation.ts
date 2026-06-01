export class CancellationToken {
  private _isCancelled = false
  private _listeners: (() => void)[] = []

  get isCancelled(): boolean {
    return this._isCancelled
  }

  cancel(): void {
    if (this._isCancelled) return
    this._isCancelled = true
    this._listeners.forEach(listener => listener())
    this._listeners = []
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
