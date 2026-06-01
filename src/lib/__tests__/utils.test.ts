import { describe, it, expect } from 'vitest'
import { formatFileSize, splitFilePath, buildOutputPath, getPageRange } from '../utils'

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB')
    expect(formatFileSize(5242880)).toBe('5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB')
  })

  it('formats fractional values correctly', () => {
    expect(formatFileSize(1024 * 1.5)).toBe('1.5 KB')
  })
})

describe('splitFilePath', () => {
  it('splits Windows path', () => {
    const result = splitFilePath('C:\\Users\\test\\file.pdf')
    expect(result.dir).toBe('C:\\Users\\test')
    expect(result.baseName).toBe('file.pdf')
    expect(result.sep).toBe('\\')
  })

  it('splits Unix path', () => {
    const result = splitFilePath('/home/user/file.pdf')
    expect(result.dir).toBe('/home/user')
    expect(result.baseName).toBe('file.pdf')
    expect(result.sep).toBe('/')
  })

  it('handles filename only', () => {
    const result = splitFilePath('file.pdf')
    expect(result.dir).toBe('')
    expect(result.baseName).toBe('file.pdf')
    expect(result.sep).toBe('/')
  })

  it('handles mixed separators', () => {
    const result = splitFilePath('C:\\Users/test\\file.pdf')
    expect(result.baseName).toBe('file.pdf')
  })
})

describe('buildOutputPath', () => {
  it('builds path with suffix', () => {
    expect(buildOutputPath('C:\\dir', 'file.pdf', '_compressed', 'pdf', '\\'))
      .toBe('C:\\dir\\file_compressed.pdf')
  })

  it('strips existing extension', () => {
    expect(buildOutputPath('/dir', 'document.pdf', '_split', 'pdf', '/'))
      .toBe('/dir/document_split.pdf')
  })

  it('strips page number suffix', () => {
    expect(buildOutputPath('/dir', 'file_page1', '_v2', 'pdf', '/'))
      .toBe('/dir/file_v2.pdf')
  })
})

describe('getPageRange', () => {
  it('returns empty for empty string', () => {
    expect(getPageRange('', 10)).toEqual([])
  })

  it('returns empty for whitespace', () => {
    expect(getPageRange('   ', 10)).toEqual([])
  })

  it('parses single page', () => {
    expect(getPageRange('3', 10)).toEqual([2])
  })

  it('parses page range', () => {
    expect(getPageRange('1-3', 10)).toEqual([0, 1, 2])
  })

  it('parses combined range', () => {
    expect(getPageRange('1-3, 5', 10)).toEqual([0, 1, 2, 4])
  })

  it('clamps to max pages', () => {
    expect(getPageRange('1-20', 5)).toEqual([0, 1, 2, 3, 4])
  })

  it('ignores invalid input', () => {
    expect(getPageRange('abc', 10)).toEqual([])
  })

  it('ignores non-numeric chars', () => {
    expect(getPageRange('1a-3b', 10)).toEqual([])
  })

  it('deduplicates pages', () => {
    expect(getPageRange('1-3, 2-4', 10)).toEqual([0, 1, 2, 3])
  })

  it('handles reversed range gracefully', () => {
    expect(getPageRange('5-3', 10)).toEqual([])
  })

  it('handles zero and negative pages', () => {
    expect(getPageRange('0, -1, 1', 10)).toEqual([0])
  })
})
