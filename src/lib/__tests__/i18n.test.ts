import { describe, test, expect } from 'vitest'
import { t, ErrorCode } from '../i18n'

describe('i18n.t', () => {
  test('returns Chinese for known ErrorCode', () => {
    expect(t(ErrorCode.FILE_NOT_FOUND)).toBe('文件不存在')
    expect(t(ErrorCode.FILE_DATA_MISSING)).toBe('文件数据已丢失，请重新添加该文件')
    expect(t(ErrorCode.WRONG_PASSWORD)).toBe('密码错误，无法解密')
  })

  test('returns Chinese for known string keys', () => {
    expect(t('errorPrefix.compress')).toBe('压缩失败')
    expect(t('errorPrefix.merge')).toBe('合并失败')
  })

  test('returns the key itself for unknown key (with dev warning)', () => {
    const r = t('UNKNOWN.KEY.that.does.not.exist')
    expect(r).toBe('UNKNOWN.KEY.that.does.not.exist')
  })

  test('performs parameter substitution on known key with placeholders', () => {
    const r = t('demo.greeting', { name: '张三', product: 'PDF 工具' })
    expect(r).toBe('你好，张三！欢迎使用 PDF 工具。')
  })

  test('handles no params gracefully', () => {
    expect(() => t(ErrorCode.FILE_NOT_FOUND)).not.toThrow()
  })

  test('leaves placeholders intact when params missing', () => {
    const r = t('demo.greeting', { name: '张三' })
    expect(r).toContain('{product}')
  })

  test('all ErrorCode values are mapped', () => {
    for (const code of Object.values(ErrorCode)) {
      const msg = t(code)
      expect(msg, `missing translation for ${code}`).not.toBe(code)
    }
  })

  test('errorPrefix.* values are mapped', () => {
    for (const key of [
      'errorPrefix.compress',
      'errorPrefix.merge',
      'errorPrefix.split',
      'errorPrefix.encrypt',
      'errorPrefix.decrypt',
      'errorPrefix.watermark',
      'errorPrefix.pageNumber',
      'errorPrefix.signature',
      'errorPrefix.annotation',
      'errorPrefix.convert',
      'errorPrefix.ocr',
    ]) {
      const msg = t(key)
      expect(msg, `missing translation for ${key}`).not.toBe(key)
    }
  })
})
