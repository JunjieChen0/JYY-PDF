import { describe, it, expect, beforeEach } from 'vitest'
import { logger } from '../logger'

describe('logger', () => {
  beforeEach(() => {
    logger.clearLogs()
  })

  it('starts with empty logs', () => {
    expect(logger.getLogs()).toEqual([])
  })

  it('logs error messages', () => {
    logger.error('test error', { detail: 'info' })
    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].level).toBe('error')
    expect(logs[0].message).toBe('test error')
  })

  it('logs warn messages', () => {
    logger.warn('test warn')
    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].level).toBe('warn')
  })

  it('logs info messages', () => {
    logger.info('test info')
    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].level).toBe('info')
  })

  it('includes timestamp', () => {
    logger.info('test')
    const logs = logger.getLogs()
    expect(logs[0].timestamp).toBeDefined()
    expect(new Date(logs[0].timestamp).getTime()).not.toBeNaN()
  })

  it('clears logs', () => {
    logger.error('a')
    logger.warn('b')
    logger.clearLogs()
    expect(logger.getLogs()).toEqual([])
  })

  it('exports logs as string', () => {
    logger.error('test error')
    logger.warn('test warn')
    const exported = logger.exportLogs()
    expect(exported).toContain('test error')
    expect(exported).toContain('test warn')
    expect(exported).toContain('[ERROR]')
    expect(exported).toContain('[WARN]')
  })

  it('truncates long string details', () => {
    const longString = 'x'.repeat(2000)
    logger.info('test', longString)
    const logs = logger.getLogs()
    expect(typeof logs[0].details).toBe('string')
    expect((logs[0].details as string).length).toBeLessThanOrEqual(1003)
  })

  it('truncates Error details', () => {
    const error = new Error('test error')
    logger.info('test', error)
    const logs = logger.getLogs()
    const details = logs[0].details as Record<string, unknown>
    expect(details.message).toBe('test error')
    expect(details.stack).toBeDefined()
  })

  it('handles undefined details', () => {
    logger.info('test')
    const logs = logger.getLogs()
    expect(logs[0].details).toBeUndefined()
  })
})
