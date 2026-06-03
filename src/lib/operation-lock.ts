/**
 * 文件级互斥锁。
 *
 * 设计目标：阻止同一文件被两个面板/操作并发处理。
 * - 锁是全局的、跨 hook 共享的
 * - acquireFileLocks 原子检查 + 占用；任一 ID 被占用则全部不占用并返回 false
 * - releaseFileLocks 释放指定 ID（即使该 ID 未被持有也安全）
 *
 * 注意：锁状态不持久化，不跨进程，仅用于同一 Electron 渲染进程内。
 */

const lockedFiles = new Set<string>()

/**
 * 检查指定文件 ID 是否已被其他操作持有。
 */
export function isFileLocked(fileId: string): boolean {
  return lockedFiles.has(fileId)
}

/**
 * 尝试一次性占用一组文件锁。
 *
 * @returns true 表示全部占用成功；false 表示至少有 ID 已被占用，全部回滚。
 */
export function acquireFileLocks(fileIds: string[]): boolean {
  if (fileIds.length === 0) return true
  for (const id of fileIds) {
    if (lockedFiles.has(id)) return false
  }
  for (const id of fileIds) {
    lockedFiles.add(id)
  }
  return true
}

/**
 * 释放一组文件锁。对未持有的 ID 是 no-op。
 */
export function releaseFileLocks(fileIds: string[]): void {
  for (const id of fileIds) {
    lockedFiles.delete(id)
  }
}

/**
 * 调试/测试用：返回当前持有锁的数量。
 */
export function getLockedFileCount(): number {
  return lockedFiles.size
}

/**
 * 调试/测试用：清空全部锁。
 */
export function clearAllFileLocks(): void {
  lockedFiles.clear()
}
