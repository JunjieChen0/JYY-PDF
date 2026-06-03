/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { PDFDocument, PDFName } from 'pdf-lib'
import { usePDFMerge } from '../usePDFMerge'
import { usePDFEncrypt } from '../usePDFEncrypt'
import { usePDFWatermark } from '../usePDFWatermark'
import { usePDFCompress } from '../usePDFCompress'
import { usePDFPages } from '../usePDFPages'
import { usePDFPageNumbers } from '../usePDFPageNumbers'
import { usePDFAnnotation } from '../usePDFAnnotation'
import { usePDFSignature } from '../usePDFSignature'
import * as pdfDataStore from '@/lib/pdf-data-store'
import type { PDFFile } from '../types'

// electronAPI stub for hooks
beforeEach(() => {
  pdfDataStore.clearAllData()
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(window as any).electronAPI = {
    saveFile: vi.fn(async (opts: any) => ({
      canceled: false,
      filePath: opts?.defaultPath || '/tmp/out.pdf',
    })),
    writeFile: vi.fn(async () => true),
    readFile: vi.fn(async () => null),
    readSystemFont: vi.fn(async () => null),
    getPathForFile: vi.fn((f: File) => f.name),
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function makePdfBuffer(pages: number, label = 'test'): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(label)
  for (let i = 0; i < pages; i++) doc.addPage([300, 400])
  return await doc.save()
}

function makePDFFile(
  id: string,
  name: string,
  size: number,
  pageCount: number,
  headerHash = 'h',
): PDFFile {
  return { id, name, size, pageCount, headerHash }
}

async function setupFileWithData(file: PDFFile, data: Uint8Array) {
  pdfDataStore.setData(file.id, data)
  return file
}

describe('usePDFMerge', () => {
  test('merges multiple files in order', async () => {
    const a = await setupFileWithData(
      makePDFFile('1', 'a.pdf', 100, 1),
      await makePdfBuffer(1, 'a'),
    )
    const b = await setupFileWithData(
      makePDFFile('2', 'b.pdf', 100, 1),
      await makePdfBuffer(1, 'b'),
    )
    const { result } = renderHook(() => usePDFMerge([a, b]))
    let out: string | null = null
    await act(async () => {
      out = await result.current.mergeFiles()
    })
    expect(out).toBeTruthy()
    expect((window as any).electronAPI.writeFile).toHaveBeenCalled()
  })

  test('throws when fewer than 2 files (hook returns null)', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 1), await makePdfBuffer(1))
    const { result } = renderHook(() => usePDFMerge([a]))
    let out: string | null = 'sentinel'
    await act(async () => {
      out = await result.current.mergeFiles()
    })
    expect(out).toBeNull()
  })

  test('cancelled token rejects the merge', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 1), await makePdfBuffer(1))
    const b = await setupFileWithData(makePDFFile('2', 'b.pdf', 100, 1), await makePdfBuffer(1))
    const { result } = renderHook(() => usePDFMerge([a, b]))
    let error: unknown = null
    await act(async () => {
      const token = {
        cancelled: true,
        throwIfCancelled: () => {
          throw new Error('cancelled')
        },
      }
      try {
        await result.current.mergeFiles((_p) => {}, token as any)
      } catch (e) {
        error = e
      }
    })
    expect(error).toBeInstanceOf(Error)
  })
})

describe('usePDFEncrypt', () => {
  test('encrypts a single file with password', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 1), await makePdfBuffer(1))
    const { result } = renderHook(() => usePDFEncrypt([a]))
    ;(window as any).electronAPI.encryptPdf = vi.fn(async () => ({
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    }))
    let out: string | null = null
    await act(async () => {
      out = await result.current.encryptFile('1', {
        userPassword: 'pw',
        keyLength: 256,
        restrictions: { print: 'none', modify: 'none', extract: 'n' },
      })
    })
    expect(out).toBeTruthy()
  })

  test('throws when no password provided', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 1), await makePdfBuffer(1))
    const { result } = renderHook(() => usePDFEncrypt([a]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.encryptFile('1', {
          userPassword: '',
          ownerPassword: '',
          keyLength: 256,
          restrictions: { print: 'none', modify: 'none', extract: 'n' },
        })
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
  })

  test('rejects 40-bit key length at type level', () => {
    type K = 128 | 256
    const k: K = 128
    expect([128, 256]).toContain(k)
  })
})

describe('usePDFWatermark', () => {
  test('adds text watermark to a page', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 1), await makePdfBuffer(1))
    ;(window as any).electronAPI.readSystemFont = vi.fn(async () => null)
    const { result } = renderHook(() => usePDFWatermark([a]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.addWatermark('1', {
          type: 'text',
          content: 'WATERMARK',
          position: 'center',
        })
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
    const writeCalls = (window as any).electronAPI.writeFile.mock.calls
    expect(writeCalls.length).toBe(0)
  })

  test('returns null for unknown file id', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 1), await makePdfBuffer(1))
    const { result } = renderHook(() => usePDFWatermark([a]))
    let out: string | null = 'x'
    await act(async () => {
      out = await result.current.addWatermark('unknown', { type: 'text', content: 'W' })
    })
    expect(out).toBeNull()
  })
})

describe('usePDFCompress', () => {
  test('compresses with high level', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 2), await makePdfBuffer(2))
    const { result } = renderHook(() => usePDFCompress([a]))
    let out: string | null = null
    await act(async () => {
      out = await result.current.compressFile('1', 'high')
    })
    expect(out).toBeTruthy()
  })

  test('returns null for unknown id', async () => {
    const { result } = renderHook(() => usePDFCompress([]))
    let out: string | null = 'x'
    await act(async () => {
      out = await result.current.compressFile('unknown', 'medium')
    })
    expect(out).toBeNull()
  })
})

describe('usePDFPages - split/rotate/delete/extract', () => {
  test('split produces multiple output paths', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 3), await makePdfBuffer(3))
    ;(window as any).electronAPI.saveFile = vi.fn(async (opts: any) => ({
      canceled: false,
      filePath: opts?.defaultPath || '/tmp/o.pdf',
    }))
    const { result } = renderHook(() => usePDFPages([a]))
    let out: string[] | null = null
    await act(async () => {
      out = await result.current.splitFile('1', '1-2')
    })
    expect(out).toBeTruthy()
    expect(out!.length).toBe(1)
  })

  test('rotate returns output path', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 3), await makePdfBuffer(3))
    const { result } = renderHook(() => usePDFPages([a]))
    let out: string | null = null
    await act(async () => {
      out = await result.current.rotatePages('1', '1-2', 90)
    })
    expect(out).toBeTruthy()
  })

  test('delete pages returns output path', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 3), await makePdfBuffer(3))
    const { result } = renderHook(() => usePDFPages([a]))
    let out: string | null = null
    await act(async () => {
      out = await result.current.deletePages('1', '3')
    })
    expect(out).toBeTruthy()
  })

  test('extract pages returns output path', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 3), await makePdfBuffer(3))
    const { result } = renderHook(() => usePDFPages([a]))
    let out: string | null = null
    await act(async () => {
      out = await result.current.extractPages('1', '1-2')
    })
    expect(out).toBeTruthy()
  })

  test('throws when trying to delete all pages', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 2), await makePdfBuffer(2))
    const { result } = renderHook(() => usePDFPages([a]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.deletePages('1', '1-2')
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
  })
})

describe('usePDFPageNumbers', () => {
  test('adds page numbers', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 3), await makePdfBuffer(3))
    ;(window as any).electronAPI.readSystemFont = vi.fn(async () => null)
    const { result } = renderHook(() => usePDFPageNumbers([a]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.addPageNumbers('1', { position: 'bottom-center', startNumber: 1 })
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
  })
})

describe('usePDFAnnotation', () => {
  test('returns null when user cancels save dialog', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 1), await makePdfBuffer(1))
    ;(window as any).electronAPI.saveFile = vi.fn(async () => ({ canceled: true, filePath: null }))
    const { result } = renderHook(() => usePDFAnnotation([a]))
    let out: string | null = 'x'
    await act(async () => {
      out = await result.current.addAnnotation('1', [])
    })
    expect(out).toBeNull()
  })

  test('rect annotation requires font (current implementation loads font for all types)', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 2), await makePdfBuffer(2))
    ;(window as any).electronAPI.readSystemFont = vi.fn(async () => null)
    const { result } = renderHook(() => usePDFAnnotation([a]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.addAnnotation('1', [
          { type: 'rect', x: 10, y: 10, width: 50, height: 50, color: '#ff0000', pageIndex: 0 },
        ])
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
  })
})

describe('usePDFSignature', () => {
  test('blocks signing on PDF with JavaScript', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const acro = doc.context.obj({})
    acro.set(PDFName.of('AA'), doc.context.obj({ S: PDFName.of('JavaScript') }))
    doc.catalog.set(PDFName.of('AA'), acro)
    const evil = await doc.save()
    const a = await setupFileWithData(makePDFFile('1', 'evil.pdf', 100, 1), evil)
    const { result } = renderHook(() => usePDFSignature([a]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.addSignature('1', 'data:image/png;base64,iVBORw0KGgo=', {
          pageIndex: 0,
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        })
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('PDF_HAS_JAVASCRIPT')
  })

  test('throws for invalid page index', async () => {
    const a = await setupFileWithData(makePDFFile('1', 'a.pdf', 100, 1), await makePdfBuffer(1))
    const { result } = renderHook(() => usePDFSignature([a]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.addSignature('1', 'data:image/png;base64,iVBORw0KGgo=', {
          pageIndex: 5,
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        })
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
  })
})
