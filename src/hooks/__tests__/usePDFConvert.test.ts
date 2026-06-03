/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePDFConvert } from '../usePDFConvert'
import { usePDFOCR } from '../usePDFOCR'
import { usePDFThumbnail } from '../usePDFThumbnail'
import * as pdfDataStore from '@/lib/pdf-data-store'
import type { PDFFile } from '../types'

beforeEach(() => {
  pdfDataStore.clearAllData()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function makePDFFile(id: string, name: string, pageCount: number): PDFFile {
  return { id, name, size: 100, pageCount, headerHash: 'h' }
}

describe('usePDFConvert - convertToImages / convertToText return null for unknown id', () => {
  test('convertToImages', async () => {
    const { result } = renderHook(() => usePDFConvert([]))
    let out: string | null = 'x'
    await act(async () => {
      out = await result.current.convertToImages('missing', 'png')
    })
    expect(out).toBeNull()
  })

  test('convertToText', async () => {
    const { result } = renderHook(() => usePDFConvert([]))
    let out: string | null = 'x'
    await act(async () => {
      out = await result.current.convertToText('missing')
    })
    expect(out).toBeNull()
  })
})

describe('usePDFConvert - pdfToWord / wordToPdf throw for unknown id', () => {
  test('pdfToWord throws 文件不存在', async () => {
    const { result } = renderHook(() => usePDFConvert([]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.pdfToWord('missing')
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('FILE_NOT_FOUND')
  })

  test('wordToPdf throws FILE_NOT_FOUND for missing path', async () => {
    ;(window as any).electronAPI.fileExists = vi.fn(async () => false)
    const { result } = renderHook(() => usePDFConvert([]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.wordToPdf('/nonexistent.docx')
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
  })
})

describe('usePDFConvert - imagesToPdf (basic wiring)', () => {
  test('hook is callable with empty file list', () => {
    const { result } = renderHook(() => usePDFConvert([]))
    expect(typeof result.current.imagesToPdf).toBe('function')
  })
})

describe('usePDFOCR', () => {
  test('throws FILE_NOT_FOUND for unknown file id', async () => {
    const { result } = renderHook(() => usePDFOCR([]))
    let err: unknown = null
    await act(async () => {
      try {
        await result.current.ocrPDF('missing', 'chi_sim')
      } catch (e) {
        err = e
      }
    })
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('FILE_NOT_FOUND')
  })
})

describe('usePDFThumbnail', () => {
  test('returns null for unknown file id', async () => {
    const { result } = renderHook(() => usePDFThumbnail([]))
    let out: string | null = 'x'
    await act(async () => {
      out = await result.current.getPageThumbnail('unknown', 0)
    })
    expect(out).toBeNull()
  })

  test('returns null when data is missing from store', async () => {
    const a = makePDFFile('1', 'a.pdf', 1)
    const { result } = renderHook(() => usePDFThumbnail([a]))
    let out: string | null = 'x'
    await act(async () => {
      out = await result.current.getPageThumbnail('1', 0)
    })
    expect(out).toBeNull()
  })
})
