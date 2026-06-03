const store = new Map<string, Uint8Array>()
const MAX_STORE_SIZE_BYTES = 500 * 1024 * 1024 // 500MB
let currentStoreSize = 0

/**
 * 存储文件二进制数据，键为文件 UUID。按引用存储（不深拷贝）。
 * 超过容量限制时按 LRU 策略淘汰最旧的数据。
 * @param id - 文件 UUID
 * @param data - PDF 字节
 */
export function setData(id: string, data: Uint8Array): void {
  // 如果已存在，先减去旧大小
  const existing = store.get(id)
  if (existing) {
    currentStoreSize -= existing.byteLength
  }

  // 淘汰最旧的数据直到有足够空间
  while (currentStoreSize + data.byteLength > MAX_STORE_SIZE_BYTES && store.size > 0) {
    const firstKey = store.keys().next().value
    if (firstKey !== undefined) {
      const removed = store.get(firstKey)
      if (removed) {
        currentStoreSize -= removed.byteLength
      }
      store.delete(firstKey)
    }
  }

  store.set(id, data)
  currentStoreSize += data.byteLength
}

/**
 * 取回文件二进制数据。
 * @returns 数据或 `undefined`（未找到）
 */
export function getData(id: string): Uint8Array | undefined {
  return store.get(id)
}

/**
 * 从 store 中删除一个文件的二进制数据（保留元数据不动）。
 * @param id - 文件 UUID
 */
export function deleteData(id: string): void {
  const data = store.get(id)
  if (data) {
    currentStoreSize -= data.byteLength
  }
  store.delete(id)
}

/**
 * 清空所有文件的二进制数据。
 */
export function clearAllData(): void {
  store.clear()
  currentStoreSize = 0
}

const MAX_THUMBNAIL_CACHE = 50
const thumbnailCache = new Map<string, string>()

function setThumbnailCache(key: string, value: string) {
  if (thumbnailCache.size >= MAX_THUMBNAIL_CACHE) {
    const firstKey = thumbnailCache.keys().next().value
    if (firstKey !== undefined) thumbnailCache.delete(firstKey)
  }
  thumbnailCache.set(key, value)
}

/**
 * 取回已缓存的缩略图 dataURL。
 * @returns dataURL 或 `undefined`
 */
export function getThumbnailFromCache(key: string): string | undefined {
  return thumbnailCache.get(key)
}

/**
 * 缓存缩略图 dataURL。超过 50 个时按插入顺序淘汰最早的。
 * @param key - 缓存键（推荐格式 `${fileId}_${pageIndex}_${maxWidth}`）
 * @param value - dataURL
 */
export function setThumbnailToCache(key: string, value: string): void {
  setThumbnailCache(key, value)
}

/**
 * 清空所有缩略图缓存。
 */
export function clearThumbnailCache(): void {
  thumbnailCache.clear()
}

/**
 * 清空指定文件的所有缩略图缓存（基于 `${fileId}_` 前缀）。
 * @param fileId - 文件 UUID
 */
export function clearThumbnailCacheForFile(fileId: string): void {
  for (const key of thumbnailCache.keys()) {
    if (key.startsWith(`${fileId}_`)) {
      thumbnailCache.delete(key)
    }
  }
}
