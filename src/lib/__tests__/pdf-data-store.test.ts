import { describe, test, expect, beforeEach } from 'vitest'
import {
  setData,
  getData,
  deleteData,
  clearAllData,
  getThumbnailFromCache,
  setThumbnailToCache,
  clearThumbnailCache,
  clearThumbnailCacheForFile,
} from '../pdf-data-store'

describe('pdf-data-store - data', () => {
  beforeEach(() => {
    clearAllData()
    clearThumbnailCache()
  })

  test('set and get', () => {
    const data = new Uint8Array([1, 2, 3])
    setData('a', data)
    expect(getData('a')).toEqual(data)
  })

  test('get returns undefined for missing id', () => {
    expect(getData('nonexistent')).toBeUndefined()
  })

  test('deleteData removes the entry', () => {
    setData('a', new Uint8Array([1]))
    expect(getData('a')).toBeDefined()
    deleteData('a')
    expect(getData('a')).toBeUndefined()
  })

  test('deleteData on non-existent id is a no-op', () => {
    expect(() => deleteData('nonexistent')).not.toThrow()
  })

  test('clearAllData empties the store', () => {
    setData('a', new Uint8Array([1]))
    setData('b', new Uint8Array([2]))
    clearAllData()
    expect(getData('a')).toBeUndefined()
    expect(getData('b')).toBeUndefined()
  })

  test('overwrite existing id replaces data', () => {
    setData('a', new Uint8Array([1]))
    setData('a', new Uint8Array([9, 8, 7]))
    expect(Array.from(getData('a')!)).toEqual([9, 8, 7])
  })

  test('data is stored by reference (mutation visible)', () => {
    const arr = new Uint8Array([1, 2, 3])
    setData('a', arr)
    arr[0] = 99
    expect(getData('a')![0]).toBe(99)
  })

  test('large data can be stored and retrieved', () => {
    const big = new Uint8Array(1024 * 1024) // 1MB
    for (let i = 0; i < big.length; i++) big[i] = i % 256
    setData('big', big)
    const got = getData('big')!
    expect(got.length).toBe(big.length)
    expect(got[0]).toBe(0)
    expect(got[256]).toBe(0)
    expect(got[1024 * 1024 - 1]).toBe(255)
  })

  test('is case-sensitive on keys', () => {
    setData('ABC', new Uint8Array([1]))
    setData('abc', new Uint8Array([2]))
    expect(getData('ABC')![0]).toBe(1)
    expect(getData('abc')![0]).toBe(2)
  })

  test('multiple sets of same key only keeps latest', () => {
    setData('k', new Uint8Array([1]))
    setData('k', new Uint8Array([2]))
    setData('k', new Uint8Array([3]))
    expect(Array.from(getData('k')!)).toEqual([3])
  })
})

describe('pdf-data-store - thumbnail cache', () => {
  beforeEach(() => {
    clearThumbnailCache()
  })

  test('set and get', () => {
    setThumbnailToCache('file1_page0', 'data:image/png;base64,xxx')
    expect(getThumbnailFromCache('file1_page0')).toBe('data:image/png;base64,xxx')
  })

  test('returns undefined for missing key', () => {
    expect(getThumbnailFromCache('nope')).toBeUndefined()
  })

  test('clearThumbnailCache empties the cache', () => {
    setThumbnailToCache('a', 'x')
    setThumbnailToCache('b', 'y')
    clearThumbnailCache()
    expect(getThumbnailFromCache('a')).toBeUndefined()
    expect(getThumbnailFromCache('b')).toBeUndefined()
  })

  test('clearThumbnailCacheForFile removes only matching file entries', () => {
    setThumbnailToCache('file1_page0', 'a')
    setThumbnailToCache('file1_page1', 'b')
    setThumbnailToCache('file2_page0', 'c')
    clearThumbnailCacheForFile('file1')
    expect(getThumbnailFromCache('file1_page0')).toBeUndefined()
    expect(getThumbnailFromCache('file1_page1')).toBeUndefined()
    expect(getThumbnailFromCache('file2_page0')).toBe('c')
  })
})
