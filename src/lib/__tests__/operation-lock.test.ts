import { describe, test, expect, beforeEach } from 'vitest'
import {
  acquireFileLocks,
  releaseFileLocks,
  isFileLocked,
  getLockedFileCount,
  clearAllFileLocks,
} from '../operation-lock'

describe('operation-lock', () => {
  beforeEach(() => {
    clearAllFileLocks()
  })

  test('no file is locked initially', () => {
    expect(isFileLocked('a')).toBe(false)
    expect(getLockedFileCount()).toBe(0)
  })

  test('acquireFileLocks returns true and locks', () => {
    expect(acquireFileLocks(['a'])).toBe(true)
    expect(isFileLocked('a')).toBe(true)
    expect(getLockedFileCount()).toBe(1)
  })

  test('acquireFileLocks fails if any id is already locked', () => {
    acquireFileLocks(['a'])
    expect(acquireFileLocks(['a', 'b'])).toBe(false)
    expect(isFileLocked('b')).toBe(false)
  })

  test('failed acquire is all-or-nothing', () => {
    acquireFileLocks(['a'])
    const ok = acquireFileLocks(['a', 'b'])
    expect(ok).toBe(false)
    // 验证 b 没被部分占用
    expect(isFileLocked('b')).toBe(false)
    // 验证 a 仍被占用（未被回滚导致状态不一致）
    expect(isFileLocked('a')).toBe(true)
  })

  test('releaseFileLocks frees', () => {
    acquireFileLocks(['a', 'b'])
    releaseFileLocks(['a'])
    expect(isFileLocked('a')).toBe(false)
    expect(isFileLocked('b')).toBe(true)
  })

  test('releaseFileLocks on non-held id is no-op', () => {
    expect(() => releaseFileLocks(['x'])).not.toThrow()
    expect(isFileLocked('x')).toBe(false)
  })

  test('acquire can re-lock after release', () => {
    acquireFileLocks(['a'])
    releaseFileLocks(['a'])
    expect(acquireFileLocks(['a'])).toBe(true)
  })

  test('empty list always succeeds and does nothing', () => {
    expect(acquireFileLocks([])).toBe(true)
    expect(getLockedFileCount()).toBe(0)
  })

  test('clearAllFileLocks empties everything', () => {
    acquireFileLocks(['a', 'b', 'c'])
    expect(getLockedFileCount()).toBe(3)
    clearAllFileLocks()
    expect(getLockedFileCount()).toBe(0)
    expect(isFileLocked('a')).toBe(false)
  })
})
