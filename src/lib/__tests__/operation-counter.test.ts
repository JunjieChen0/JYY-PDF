import { describe, test, expect, beforeEach } from 'vitest'
import { acquireOperation, releaseOperation, getActiveCount } from '../operation-counter'

describe('operation-counter', () => {
  beforeEach(() => {
    while (getActiveCount() > 0) {
      releaseOperation()
    }
  })

  test('starts at 0', () => {
    expect(getActiveCount()).toBe(0)
  })

  test('acquire increments', () => {
    acquireOperation()
    expect(getActiveCount()).toBe(1)
    acquireOperation()
    expect(getActiveCount()).toBe(2)
  })

  test('release decrements', () => {
    acquireOperation()
    acquireOperation()
    releaseOperation()
    expect(getActiveCount()).toBe(1)
  })

  test('release does not go below 0 (lower bound protection)', () => {
    releaseOperation()
    releaseOperation()
    releaseOperation()
    expect(getActiveCount()).toBe(0)
  })

  test('acquire/release pairing keeps count correct', () => {
    for (let i = 0; i < 10; i++) acquireOperation()
    expect(getActiveCount()).toBe(10)
    for (let i = 0; i < 10; i++) releaseOperation()
    expect(getActiveCount()).toBe(0)
  })

  test('concurrent-like acquire/release via interleaving', () => {
    acquireOperation()
    acquireOperation()
    acquireOperation()
    expect(getActiveCount()).toBe(3)
    releaseOperation()
    acquireOperation()
    expect(getActiveCount()).toBe(3)
  })

  test('getActiveCount is read-only', () => {
    acquireOperation()
    const c1 = getActiveCount()
    const c2 = getActiveCount()
    expect(c1).toBe(c2)
    expect(c1).toBe(1)
  })

  test('large concurrent count', () => {
    for (let i = 0; i < 200; i++) acquireOperation()
    expect(getActiveCount()).toBe(200)
    for (let i = 0; i < 200; i++) releaseOperation()
    expect(getActiveCount()).toBe(0)
  })
})
