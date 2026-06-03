import { describe, test, expect, beforeAll } from 'vitest'
import i18next from 'i18next'
import zh from '@/i18n/zh.json'
import { t, ErrorCode } from '../i18n'

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.init({
      resources: { zh: { translation: zh } },
      fallbackLng: 'zh',
      interpolation: { escapeValue: false },
    })
  }
})

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
    const r = t('app.fileTooLarge', { name: '测试.pdf' })
    expect(r).toBe('文件 测试.pdf 超过最大限制100MB，无法添加')
  })

  test('handles no params gracefully', () => {
    expect(() => t(ErrorCode.FILE_NOT_FOUND)).not.toThrow()
  })

  test('leaves placeholders intact when params missing', () => {
    const r = t('app.fileTooLarge')
    expect(r).toContain('{{name}}')
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
