import { describe, it, expect, vi } from 'vitest'
import { CancellationToken, CancelledError, createCancellationToken } from '../cancellation'

describe('CancellationToken', () => {
  it('starts as not cancelled', () => {
    const token = new CancellationToken()
    expect(token.isCancelled).toBe(false)
  })

  it('becomes cancelled after cancel()', () => {
    const token = new CancellationToken()
    token.cancel()
    expect(token.isCancelled).toBe(true)
  })

  it('throwIfCancelled throws CancelledError when cancelled', () => {
    const token = new CancellationToken()
    token.cancel()
    expect(() => token.throwIfCancelled()).toThrow(CancelledError)
  })

  it('throwIfCancelled does nothing when not cancelled', () => {
    const token = new CancellationToken()
    expect(() => token.throwIfCancelled()).not.toThrow()
  })

  it('calls onCancel listeners immediately if already cancelled', () => {
    const token = new CancellationToken()
    token.cancel()
    const fn = vi.fn()
    token.onCancel(fn)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('calls onCancel listeners when cancelled later', () => {
    const token = new CancellationToken()
    const fn = vi.fn()
    token.onCancel(fn)
    expect(fn).not.toHaveBeenCalled()
    token.cancel()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('calls multiple listeners', () => {
    const token = new CancellationToken()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    token.onCancel(fn1)
    token.onCancel(fn2)
    token.cancel()
    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('ignores listener errors and calls all listeners', () => {
    const token = new CancellationToken()
    const fn1 = vi.fn(() => { throw new Error('boom') })
    const fn2 = vi.fn()
    token.onCancel(fn1)
    token.onCancel(fn2)
    token.cancel()
    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('cancel is idempotent', () => {
    const token = new CancellationToken()
    const fn = vi.fn()
    token.onCancel(fn)
    token.cancel()
    token.cancel()
    expect(fn).toHaveBeenCalledOnce()
  })
})

describe('CancelledError', () => {
  it('has correct name', () => {
    const error = new CancelledError()
    expect(error.name).toBe('CancelledError')
  })

  it('has default message', () => {
    const error = new CancelledError()
    expect(error.message).toBe('操作已取消')
  })

  it('accepts custom message', () => {
    const error = new CancelledError('custom')
    expect(error.message).toBe('custom')
  })
})

describe('createCancellationToken', () => {
  it('returns a new CancellationToken', () => {
    const token = createCancellationToken()
    expect(token).toBeInstanceOf(CancellationToken)
    expect(token.isCancelled).toBe(false)
  })
})
