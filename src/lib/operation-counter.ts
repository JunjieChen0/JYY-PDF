type Listener = (activeCount: number) => void

let activeCount = 0
const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) {
    listener(activeCount)
  }
}

/**
 * 增加活跃操作计数（用于限制并发操作数）。每次成功获取应配对调用 `releaseOperation`。
 */
export function acquireOperation(): void {
  activeCount += 1
  notify()
}

/**
 * 释放一个活跃操作计数。已有下限保护（不会减到 0 以下）。
 */
export function releaseOperation(): void {
  activeCount = Math.max(0, activeCount - 1)
  notify()
}

/**
 * 获取当前活跃操作数（只读）。
 */
export function getActiveCount(): number {
  return activeCount
}

/**
 * 订阅活跃操作计数变化，立即触发一次以同步当前值。
 * @param listener - 计数变化时调用的回调
 * @returns 取消订阅的函数
 */
export function subscribeOperations(listener: Listener): () => void {
  listeners.add(listener)
  listener(activeCount)
  return () => {
    listeners.delete(listener)
  }
}
