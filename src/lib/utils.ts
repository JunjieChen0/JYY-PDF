import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getPageRange(rangeStr: string, maxPages: number): number[] {
  const pages: number[] = []
  // 输入为空直接返回
  if (!rangeStr || rangeStr.trim() === '') return pages
  // 校验输入是否只有数字、-、,
  if (!/^[0-9\-,\s]+$/.test(rangeStr)) return pages
  
  const parts = rangeStr.split(',').map(p => p.trim())
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(n => n.trim())
      const start = parseInt(startStr)
      const end = parseInt(endStr)
      // 解析失败或者范围无效直接跳过
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
