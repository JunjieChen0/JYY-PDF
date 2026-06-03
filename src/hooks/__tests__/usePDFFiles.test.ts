import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePDFFiles } from '../usePDFFiles'
import { PDFDocument } from 'pdf-lib'
import * as pdfDataStore from '@/lib/pdf-data-store'
import { MAX_FILE_SIZE } from '@/lib/constants'

/**
 * 构造一个有效的 PDF File 对象。
 * name, size, data 可控；window.electronAPI 已通过测试环境 stub。
 */
async function makePdfFile(
  name: string,
  options: { pages?: number; data?: Uint8Array; size?: number } = {},
): Promise<File> {
  const pages = options.pages ?? 1
  let data: Uint8Array
  if (options.data) {
    data = options.data
  } else {
    const doc = await PDFDocument.create()
    for (let i = 0; i < pages; i++) doc.addPage()
    data = await doc.save()
  }
  const size = options.size ?? data.length
  const blob = new Blob([data as BlobPart], { type: 'application/pdf' })
  const file = new File([blob], name, { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: size, configurable: true })
  return file
}

function makeNonPdfFile(name: string): File {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'text/plain' })
  return new File([blob], name, { type: 'text/plain' })
}

beforeEach(() => {
  pdfDataStore.clearAllData()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('usePDFFiles - addFiles', () => {
  test('starts with empty files', () => {
    const { result } = renderHook(() => usePDFFiles())
    expect(result.current.files).toEqual([])
  })

  test('adds a single valid PDF', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const file = await makePdfFile('a.pdf')
    await act(async () => {
      await result.current.addFiles([file])
    })
    expect(result.current.files).toHaveLength(1)
    expect(result.current.files[0].name).toBe('a.pdf')
    expect(result.current.files[0].size).toBe(file.size)
    expect(result.current.files[0].pageCount).toBeGreaterThanOrEqual(1)
    expect(result.current.files[0].id).toBeTruthy()
  })

  test('adds multiple valid PDFs', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const files = await Promise.all([
      makePdfFile('a.pdf', { pages: 1 }),
      makePdfFile('b.pdf', { pages: 2 }),
      makePdfFile('c.pdf', { pages: 3 }),
    ])
    await act(async () => {
      await result.current.addFiles(files)
    })
    expect(result.current.files).toHaveLength(3)
    expect(result.current.files.map((f) => f.name).sort()).toEqual(['a.pdf', 'b.pdf', 'c.pdf'])
  })

  test('rejects file exceeding MAX_FILE_SIZE', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const file = await makePdfFile('huge.pdf', { size: MAX_FILE_SIZE + 1 })
    await act(async () => {
      await result.current.addFiles([file])
    })
    expect(result.current.files).toHaveLength(0)
  })

  test('rejects non-PDF file (header validation fails)', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const file = makeNonPdfFile('note.txt')
    await act(async () => {
      await result.current.addFiles([file])
    })
    expect(result.current.files).toHaveLength(0)
  })

  test('deduplicates by name+size+headerHash', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const file = await makePdfFile('dup.pdf')
    await act(async () => {
      await result.current.addFiles([file])
    })
    expect(result.current.files).toHaveLength(1)
    // 再次添加相同文件，应被去重
    const file2 = await makePdfFile('dup.pdf')
    await act(async () => {
      await result.current.addFiles([file2])
    })
    expect(result.current.files).toHaveLength(1)
  })

  test('stores file data in pdfDataStore for later retrieval', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const file = await makePdfFile('store.pdf')
    await act(async () => {
      await result.current.addFiles([file])
    })
    const id = result.current.files[0].id
    const data = pdfDataStore.getData(id)
    expect(data).toBeDefined()
    expect(data!.length).toBe(file.size)
  })

  test('mixed valid/invalid: only valid added', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const valid = await makePdfFile('ok.pdf')
    const invalid = makeNonPdfFile('bad.txt')
    await act(async () => {
      await result.current.addFiles([valid, invalid, valid])
    })
    expect(result.current.files).toHaveLength(1)
    expect(result.current.files[0].name).toBe('ok.pdf')
  })

  test('preserves insertion order', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const files = await Promise.all(['z', 'a', 'm'].map((n) => makePdfFile(`${n}.pdf`)))
    await act(async () => {
      await result.current.addFiles(files)
    })
    expect(result.current.files.map((f) => f.name)).toEqual(['z.pdf', 'a.pdf', 'm.pdf'])
  })
})

describe('usePDFFiles - removeFile', () => {
  test('removes file by id', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const file = await makePdfFile('r.pdf')
    await act(async () => {
      await result.current.addFiles([file])
    })
    const id = result.current.files[0].id
    act(() => {
      result.current.removeFile(id)
    })
    expect(result.current.files).toHaveLength(0)
    expect(pdfDataStore.getData(id)).toBeUndefined()
  })

  test('removing non-existent id is a no-op', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const file = await makePdfFile('keep.pdf')
    await act(async () => {
      await result.current.addFiles([file])
    })
    act(() => {
      result.current.removeFile('nonexistent-id')
    })
    expect(result.current.files).toHaveLength(1)
  })
})

describe('usePDFFiles - reorderFiles', () => {
  test('moves file from one index to another', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const files = await Promise.all(['a', 'b', 'c'].map((n) => makePdfFile(`${n}.pdf`)))
    await act(async () => {
      await result.current.addFiles(files)
    })
    act(() => {
      result.current.reorderFiles(0, 2)
    })
    expect(result.current.files.map((f) => f.name)).toEqual(['b.pdf', 'c.pdf', 'a.pdf'])
  })

  test('reorder with same index is no-op', async () => {
    const { result } = renderHook(() => usePDFFiles())
    const files = await Promise.all(['a', 'b'].map((n) => makePdfFile(`${n}.pdf`)))
    await act(async () => {
      await result.current.addFiles(files)
    })
    act(() => {
      result.current.reorderFiles(0, 0)
    })
    expect(result.current.files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf'])
  })
})
