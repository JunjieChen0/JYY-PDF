import { describe, test, expect } from 'vitest'
import path from 'path'

function isPathSafe(filePath: unknown): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  if (filePath.includes('\0')) return false
  if (filePath.includes('..') || filePath.match(/%2e|%252e/i)) return false
  const normalized = path.normalize(filePath)
  if (normalized.includes('..') || normalized.includes('\0')) return false
  return true
}

function sanitizeDefaultPath(input: unknown): string {
  if (!input || typeof input !== 'string') return ''
  let decoded: string
  try {
    decoded = decodeURIComponent(input).replace(/%2e/gi, '.').replace(/%252e/gi, '.')
  } catch {
    decoded = input.replace(/%2e/gi, '.').replace(/%252e/gi, '.')
  }
  let sanitized = decoded.replace(/\.\./g, '')
  sanitized = path.normalize(sanitized)
  if (sanitized.includes('..')) return ''
  if (path.isAbsolute(sanitized)) {
    sanitized = path.basename(sanitized)
  }
  return sanitized
}

describe('isPathSafe', () => {
  test('accepts valid paths', () => {
    expect(isPathSafe('C:\\Users\\test\\file.pdf')).toBe(true)
    expect(isPathSafe('/home/user/file.pdf')).toBe(true)
    expect(isPathSafe('file.pdf')).toBe(true)
  })

  test('rejects null/undefined/empty', () => {
    expect(isPathSafe(null)).toBe(false)
    expect(isPathSafe(undefined)).toBe(false)
    expect(isPathSafe('')).toBe(false)
    expect(isPathSafe(123)).toBe(false)
  })

  test('rejects path traversal', () => {
    expect(isPathSafe('../etc/passwd')).toBe(false)
    expect(isPathSafe('foo/../../../etc/passwd')).toBe(false)
    expect(isPathSafe('foo/..\\..\\windows\\system32')).toBe(false)
  })

  test('rejects encoded traversal', () => {
    expect(isPathSafe('%2e%2e/etc/passwd')).toBe(false)
    expect(isPathSafe('%252e%252e/etc/passwd')).toBe(false)
  })

  test('rejects null bytes', () => {
    expect(isPathSafe('file.pdf\0.txt')).toBe(false)
    expect(isPathSafe('C:\\Users\\test\0\\file.pdf')).toBe(false)
    expect(isPathSafe('\0')).toBe(false)
  })

  test('rejects null bytes after normalization', () => {
    expect(isPathSafe('file.pdf\0\\..\\..\\etc\\passwd')).toBe(false)
  })
})

describe('sanitizeDefaultPath', () => {
  test('returns empty for null/undefined/empty', () => {
    expect(sanitizeDefaultPath(null)).toBe('')
    expect(sanitizeDefaultPath(undefined)).toBe('')
    expect(sanitizeDefaultPath('')).toBe('')
  })

  test('returns basename for absolute paths', () => {
    expect(sanitizeDefaultPath('C:\\Users\\test\\file.pdf')).toBe('file.pdf')
    expect(sanitizeDefaultPath('/home/user/file.pdf')).toBe('file.pdf')
  })

  test('removes path traversal', () => {
    const result = sanitizeDefaultPath('../../../etc/passwd')
    expect(result).not.toContain('..')
  })

  test('handles encoded dots', () => {
    const result = sanitizeDefaultPath('%2e%2e/secret')
    expect(result).not.toContain('..')
  })

  test('handles empty after sanitization', () => {
    const result = sanitizeDefaultPath('..')
    expect(result).not.toContain('..')
  })
})
