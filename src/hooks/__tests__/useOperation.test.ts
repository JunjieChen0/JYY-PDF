import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOperation } from '../useOperation'

describe('useOperation', () => {
  it('initializes with correct defaults', () => {
    const { result } = renderHook(() => useOperation())
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.progress).toBe(0)
  })

  it('sets isProcessing during execution', async () => {
    const { result } = renderHook(() => useOperation())

    await act(async () => {
      await result.current.execute(async (onProgress) => {
        onProgress(50)
        return 'done'
      })
    })

    expect(result.current.isProcessing).toBe(false)
    expect(result.current.progress).toBe(0)
  })

  it('returns result from operation', async () => {
    const { result } = renderHook(() => useOperation())
    let output: string | null = null

    await act(async () => {
      output = await result.current.execute(async () => 'success')
    })

    expect(output).toBe('success')
  })

  it('returns null on error', async () => {
    const { result } = renderHook(() => useOperation())
    let output: string | null = 'initial'

    await act(async () => {
      output = await result.current.execute(async () => {
        throw new Error('fail')
      })
    })

    expect(output).toBeNull()
  })

  it('resets progress after execution', async () => {
    const { result } = renderHook(() => useOperation())

    await act(async () => {
      await result.current.execute(async (onProgress) => {
        onProgress(75)
        return true
      })
    })

    expect(result.current.progress).toBe(0)
  })
})
