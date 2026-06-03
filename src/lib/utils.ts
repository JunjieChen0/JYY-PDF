import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind CSS 类名（去重 + 冲突解决）。
 * @param inputs - 类名值（支持条件表达式、数组、对象）
 * @returns 合并后的类名字符串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 将字节数格式化为人类可读的文件大小。
 * @param bytes - 字节数
 * @returns 格式化字符串（如 `'1.5 MB'`）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 拆分文件路径为目录、文件名和分隔符。
 * 自动处理 Windows（`\`）和 Unix（`/`）路径。
 * @param filePath - 完整文件路径
 * @returns `{ dir, baseName, sep }`
 */
export function splitFilePath(filePath: string): { dir: string; baseName: string; sep: string } {
  const normalized = filePath.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  const sep = filePath.includes('\\') ? '\\' : '/'
  if (lastSlash === -1) {
    return { dir: '', baseName: filePath, sep }
  }
  return {
    dir: filePath.substring(0, lastSlash),
    baseName: normalized.substring(lastSlash + 1),
    sep,
  }
}

/**
 * 构建输出文件路径。
 * @param dir - 目录路径
 * @param baseName - 原文件名（含扩展名）
 * @param suffix - 追加后缀（如 `_compressed`）
 * @param ext - 新扩展名（不含点）
 * @param sep - 路径分隔符
 * @returns 完整输出路径
 */
export function buildOutputPath(
  dir: string,
  baseName: string,
  suffix: string,
  ext: string,
  sep: string,
): string {
  const cleanBase = baseName.replace(/\.[^.]+$/, '').replace(/_page\d+$/, '')
  return `${dir}${sep}${cleanBase}${suffix}.${ext}`
}

/**
 * 解析页码范围字符串为 0-based 页码数组。
 *
 * 支持格式：`"1,3,5-8"` → `[0, 2, 4, 5, 6, 7]`
 * - 逗号分隔多段
 * - 连字符表示范围（含两端）
 * - 超出 maxPages 的页码被忽略
 * - 结果自动去重并排序
 *
 * @param rangeStr - 页码范围字符串
 * @param maxPages - 文档总页数
 * @returns 0-based 页码数组（已排序去重）
 */
export function getPageRange(rangeStr: string, maxPages: number): number[] {
  const pages: number[] = []
  if (!rangeStr || rangeStr.trim() === '') return pages
  if (!/^[0-9,\s-]+$/.test(rangeStr)) return pages

  const parts = rangeStr.split(',').map((p) => p.trim())

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((n) => n.trim())
      const start = parseInt(startStr)
      const end = parseInt(endStr)
      if (isNaN(start) || isNaN(end) || start > end) continue
      for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
        pages.push(i - 1)
      }
    } else {
      const page = parseInt(part)
      if (!isNaN(page) && page >= 1 && page <= maxPages) {
        pages.push(page - 1)
      }
    }
  }

  return [...new Set(pages)].sort((a, b) => a - b)
}
