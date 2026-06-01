import { describe, it, expect } from 'vitest'
import { hexToRgb, estimateTextWidth, validatePdfHeader, checkResult, isFileResult, yieldToMain } from '../pdf-helpers'

describe('hexToRgb', () => {
  it('converts 6-digit hex', () => {
    const result = hexToRgb('#ff0000')
    expect(result.red).toBeCloseTo(1, 2)
    expect(result.green).toBeCloseTo(0, 2)
    expect(result.blue).toBeCloseTo(0, 2)
  })

  it('converts 3-digit hex', () => {
    const result = hexToRgb('#f00')
    expect(result.red).toBeCloseTo(1, 2)
    expect(result.green).toBeCloseTo(0, 2)
    expect(result.blue).toBeCloseTo(0, 2)
  })

  it('converts hex without #', () => {
    const result = hexToRgb('00ff00')
    expect(result.red).toBeCloseTo(0, 2)
    expect(result.green).toBeCloseTo(1, 2)
    expect(result.blue).toBeCloseTo(0, 2)
  })

  it('converts black', () => {
    const result = hexToRgb('#000000')
    expect(result.red).toBeCloseTo(0, 2)
    expect(result.green).toBeCloseTo(0, 2)
    expect(result.blue).toBeCloseTo(0, 2)
  })

  it('converts white', () => {
    const result = hexToRgb('#ffffff')
    expect(result.red).toBeCloseTo(1, 2)
    expect(result.green).toBeCloseTo(1, 2)
    expect(result.blue).toBeCloseTo(1, 2)
  })

  it('returns black for invalid hex', () => {
    const result = hexToRgb('invalid')
    expect(result.red).toBe(0)
    expect(result.green).toBe(0)
    expect(result.blue).toBe(0)
  })
})

describe('estimateTextWidth', () => {
  it('estimates ASCII text width', () => {
    const width = estimateTextWidth('hello', 16)
    expect(width).toBeGreaterThan(0)
  })

  it('estimates Chinese text width', () => {
    const width = estimateTextWidth('你好', 16)
    expect(width).toBeGreaterThan(0)
    expect(width).toBe(32) // 2 chars * fontSize
  })

  it('returns 0 for empty string', () => {
    expect(estimateTextWidth('', 16)).toBe(0)
  })

  it('scales with font size', () => {
    const small = estimateTextWidth('test', 12)
    const large = estimateTextWidth('test', 24)
    expect(large).toBeGreaterThan(small)
  })
})

describe('isFileResult', () => {
  it('returns true for object with error', () => {
    expect(isFileResult({ error: 'fail' })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isFileResult(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isFileResult(undefined)).toBe(false)
  })

  it('returns false for string', () => {
    expect(isFileResult('error')).toBe(false)
  })

  it('returns false for object without error', () => {
    expect(isFileResult({ data: 'ok' })).toBe(false)
  })
})

describe('checkResult', () => {
  it('throws on error result', () => {
    expect(() => checkResult({ error: 'fail' }, 'prefix:')).toThrow('prefix:fail')
  })

  it('does not throw on non-error result', () => {
    expect(() => checkResult(true, 'prefix:')).not.toThrow()
  })

  it('does not throw on null', () => {
    expect(() => checkResult(null, 'prefix:')).not.toThrow()
  })
})

describe('validatePdfHeader', () => {
  it('passes for valid PDF header', () => {
    const encoder = new TextEncoder()
    const data = encoder.encode('%PDF-1.4 some content')
    expect(() => validatePdfHeader(data)).not.toThrow()
  })

  it('throws for invalid header', () => {
    const encoder = new TextEncoder()
    const data = encoder.encode('NOT A PDF')
    expect(() => validatePdfHeader(data)).toThrow('不是有效的PDF文档')
  })

  it('throws for empty data', () => {
    const data = new Uint8Array(0)
    expect(() => validatePdfHeader(data)).toThrow()
  })
})

describe('yieldToMain', () => {
  it('resolves', async () => {
    await expect(yieldToMain()).resolves.toBeUndefined()
  })
})
