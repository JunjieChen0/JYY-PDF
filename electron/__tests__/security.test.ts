import { describe, test, expect } from 'vitest'
import * as pathSafety from '../lib/path-safety'
import path from 'path'

const { isPathSafe, isPathAllowed, sanitizeDefaultPath, createPathRegistry, sanitizeError } = pathSafety

describe('isPathSafe', () => {
  test('accepts valid paths', () => {
    expect(isPathSafe('C:\\Users\\test\\file.pdf')).toBe(true)
    expect(isPathSafe('/home/user/file.pdf')).toBe(true)
    expect(isPathSafe('file.pdf')).toBe(true)
  })

  test('rejects null/undefined/empty', () => {
    expect(isPathSafe(null as unknown as string)).toBe(false)
    expect(isPathSafe(undefined as unknown as string)).toBe(false)
    expect(isPathSafe('')).toBe(false)
    expect(isPathSafe(123 as unknown as string)).toBe(false)
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
    expect(sanitizeDefaultPath(null as unknown as string)).toBe('')
    expect(sanitizeDefaultPath(undefined as unknown as string)).toBe('')
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

describe('isPathAllowed', () => {
  test('rejects unsafe paths regardless of registry', () => {
    const registry = createPathRegistry()
    registry.add('C:\\safe\\file.pdf')
    expect(isPathAllowed('../etc/passwd', 'read', registry)).toBe(false)
    expect(isPathAllowed('file.pdf\0.exe', 'read', registry)).toBe(false)
  })

  test('rejects paths not in registry', () => {
    const registry = createPathRegistry()
    registry.add('C:\\allowed\\file.pdf')
    expect(isPathAllowed('C:\\other\\file.pdf', 'read', registry)).toBe(false)
  })

  test('allows registered read paths with allowed extension', () => {
    const registry = createPathRegistry()
    registry.add('C:\\docs\\file.pdf')
    registry.add('C:\\docs\\image.png')
    expect(isPathAllowed('C:\\docs\\file.pdf', 'read', registry)).toBe(true)
    expect(isPathAllowed('C:\\docs\\image.png', 'read', registry)).toBe(true)
  })

  test('allows reading .docx and .doc files', () => {
    const registry = createPathRegistry()
    registry.add('C:\\docs\\report.docx')
    registry.add('C:\\docs\\old.doc')
    expect(isPathAllowed('C:\\docs\\report.docx', 'read', registry)).toBe(true)
    expect(isPathAllowed('C:\\docs\\old.doc', 'read', registry)).toBe(true)
  })

  test('rejects read with disallowed extension', () => {
    const registry = createPathRegistry()
    registry.add('C:\\docs\\script.exe')
    expect(isPathAllowed('C:\\docs\\script.exe', 'read', registry)).toBe(false)
  })

  test('write mode allows write extensions', () => {
    const registry = createPathRegistry()
    registry.add('C:\\out\\result.pdf')
    registry.add('C:\\out\\image.png')
    registry.add('C:\\out\\doc.docx')
    expect(isPathAllowed('C:\\out\\result.pdf', 'write', registry)).toBe(true)
    expect(isPathAllowed('C:\\out\\image.png', 'write', registry)).toBe(true)
    expect(isPathAllowed('C:\\out\\doc.docx', 'write', registry)).toBe(true)
  })

  test('write mode rejects read-only extensions', () => {
    const registry = createPathRegistry()
    registry.add('C:\\out\\script.exe')
    expect(isPathAllowed('C:\\out\\script.exe', 'write', registry)).toBe(false)
  })

  test('rejects when registry missing has()', () => {
    expect(isPathAllowed('C:\\docs\\file.pdf', 'read', null as unknown as ReturnType<typeof createPathRegistry>)).toBe(false)
  })

  test('handles path normalization', () => {
    const registry = createPathRegistry()
    const full = path.normalize('C:\\docs\\file.pdf')
    registry.add(full)
    expect(isPathAllowed('C:\\docs\\.\\file.pdf', 'read', registry)).toBe(true)
  })
})

describe('createPathRegistry', () => {
  test('add and has are consistent', () => {
    const registry = createPathRegistry()
    expect(registry.size()).toBe(0)
    registry.add('C:\\docs\\a.pdf')
    expect(registry.has('C:\\docs\\a.pdf')).toBe(true)
    expect(registry.size()).toBe(1)
  })

  test('ignores empty/falsy paths', () => {
    const registry = createPathRegistry()
    registry.add('')
    registry.add(null as unknown as string)
    expect(registry.size()).toBe(0)
  })

  test('clear empties the registry', () => {
    const registry = createPathRegistry()
    registry.add('C:\\docs\\a.pdf')
    registry.add('C:\\docs\\b.pdf')
    registry.clear()
    expect(registry.size()).toBe(0)
    expect(registry.has('C:\\docs\\a.pdf')).toBe(false)
  })

  test('normalizes paths on add', () => {
    const registry = createPathRegistry()
    registry.add('C:\\docs\\.\\a.pdf')
    expect(registry.has('C:\\docs\\a.pdf')).toBe(true)
  })

  test('distinct paths remain distinct', () => {
    const registry = createPathRegistry()
    registry.add('C:\\docs\\a.pdf')
    registry.add('C:\\docs\\b.pdf')
    expect(registry.has('C:\\docs\\a.pdf')).toBe(true)
    expect(registry.has('C:\\docs\\b.pdf')).toBe(true)
    expect(registry.has('C:\\docs\\c.pdf')).toBe(false)
  })
})

describe('sanitizeError', () => {
  test('returns fallback for null/undefined', () => {
    expect(sanitizeError(null, '操作失败')).toBe('操作失败')
    expect(sanitizeError(undefined, '操作失败')).toBe('操作失败')
  })

  test('returns fallback by default', () => {
    expect(sanitizeError(new Error('boom'))).toBe('操作失败')
  })

  test('passes through whitelisted safe messages', () => {
    expect(sanitizeError(new Error('Invalid file path'))).toBe('Invalid file path')
    expect(sanitizeError(new Error('Not a valid PDF file'))).toBe('Not a valid PDF file')
    expect(sanitizeError(new Error('请至少设置用户密码或所有者密码'))).toBe('请至少设置用户密码或所有者密码')
  })

  test('preserves size-limit messages', () => {
    expect(sanitizeError(new Error('写入内容过大（最大 500MB）'))).toBe('写入内容过大（最大 500MB）')
    expect(sanitizeError(new Error('File too large (max 200MB)'))).toBe('File too large (max 200MB)')
  })

  test('maps qpdf errors', () => {
    expect(sanitizeError(new Error('qpdf: invalid password'))).toBe('密码错误，无法解密')
    expect(sanitizeError(new Error('qpdf 操作超时（30秒）'))).toBe('qpdf 操作超时（30秒）')
    expect(sanitizeError(new Error('qpdf: unknown failure'))).toBe('qpdf 命令执行失败')
  })

  test('maps mammoth/printToPDF errors', () => {
    expect(sanitizeError(new Error('mammoth convertToHtml failed'))).toBe('Word 文档解析失败，请检查文件格式是否正确')
    expect(sanitizeError(new Error('printToPDF timeout'))).toBe('PDF 生成失败，请重试')
  })

  test('maps system errno to safe Chinese message', () => {
    expect(sanitizeError(new Error('EACCES: permission denied'))).toBe('文件访问被拒绝')
    expect(sanitizeError(new Error('ENOENT: no such file'))).toBe('文件不存在')
    expect(sanitizeError(new Error('ENOSPC: no space left'))).toBe('磁盘空间不足')
  })

  test('strips absolute Windows paths', () => {
    const result = sanitizeError(new Error('Failed to read C:\\Users\\admin\\secret\\file.pdf'))
    expect(result).not.toContain('C:\\Users')
    expect(result).not.toContain('admin')
    expect(result).toContain('[路径]')
  })

  test('strips absolute Unix paths', () => {
    const result = sanitizeError(new Error('Failed to read /home/admin/secret/file.pdf'))
    expect(result).not.toContain('/home')
    expect(result).not.toContain('admin')
    expect(result).toContain('[路径]')
  })

  test('returns fallback when message would be empty after stripping', () => {
    const result = sanitizeError(new Error('C:\\Users\\admin\\file.pdf'))
    expect(result).toBe('操作失败')
  })

  test('handles non-Error objects', () => {
    expect(sanitizeError('plain string' as unknown as Error, '操作失败')).toBe('操作失败')
  })
})
