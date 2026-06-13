import { describe, test, expect } from 'vitest'
import path from 'path'
import { resolveAppUrlToFilePath } from '../lib/app-protocol'

const ROOT = '/app/dist/tesseract'

function ok(url: string) {
  return resolveAppUrlToFilePath(url, ROOT)
}

describe('resolveAppUrlToFilePath - protocol/host', () => {
  test('rejects non-app: protocol', () => {
    const r = ok('https://local/worker.min.js')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(404)
  })

  test('rejects wrong host', () => {
    const r = ok('app://other/worker.min.js')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })

  test('rejects empty/non-string input', () => {
    expect(ok('').ok).toBe(false)
    expect(ok(null as unknown as string).ok).toBe(false)
  })

  test('rejects malformed url', () => {
    const r = ok('not a url')
    expect(r.ok).toBe(false)
  })
})

describe('resolveAppUrlToFilePath - path traversal', () => {
  test('rejects .. traversal', () => {
    const r = ok('app://local/../../etc/passwd')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })

  test('rejects deep .. traversal', () => {
    const r = ok('app://local/worker.min.js/../../../etc/passwd')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })

  test('rejects URL-encoded ..', () => {
    const r = ok('app://local/%2e%2e/%2e%2e/etc/passwd')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })

  test('rejects double-encoded ..', () => {
    const r = ok('app://local/%252e%252e/etc/passwd')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })

  test('rejects null bytes', () => {
    const r = ok('app://local/worker%00.exe')
    expect(r.ok).toBe(false)
  })

  test('rejects traversal that pops above root', () => {
    const r = ok('app://local/../../../etc/passwd')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })
})

describe('resolveAppUrlToFilePath - absolute path injection', () => {
  test('rejects Windows-style absolute path with drive letter', () => {
    const r = ok('app://local/C:/Windows/win.ini')
    expect(r.ok).toBe(false)
  })

  test('rejects Unix absolute path via double slash', () => {
    const r = ok('app://local//etc/passwd')
    expect(r.ok).toBe(false)
  })

  test('rejects different drive', () => {
    const r = ok('app://local/D:/Windows/win.ini')
    expect(r.ok).toBe(false)
  })
})

describe('resolveAppUrlToFilePath - legitimate asset paths', () => {
  test('accepts bare worker.min.js', () => {
    const r = ok('app://local/worker.min.js')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.filePath).toBe(path.resolve(ROOT, 'worker.min.js'))
    }
  })

  test('accepts core asset (relative)', () => {
    const r = ok('app://local/core/tesseract-core.wasm.js')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.filePath).toBe(path.resolve(ROOT, 'core', 'tesseract-core.wasm.js'))
    }
  })

  test('accepts lang-data asset (relative)', () => {
    const r = ok('app://local/lang-data/eng.traineddata.gz')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.filePath).toBe(path.resolve(ROOT, 'lang-data', 'eng.traineddata.gz'))
    }
  })

  test('accepts nested core path (e.g. core/anything/file)', () => {
    const r = ok('app://local/core/sub/dir/file.wasm')
    expect(r.ok).toBe(true)
  })

  test('accepts nested lang-data path', () => {
    const r = ok('app://local/lang-data/sub/file.gz')
    expect(r.ok).toBe(true)
  })

  test('accepts normalized .. that stays inside root', () => {
    const r = ok('app://local/core/../worker.min.js')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.filePath).toBe(path.resolve(ROOT, 'worker.min.js'))
    }
  })

  test('accepts . segments', () => {
    const r = ok('app://local/./worker.min.js')
    expect(r.ok).toBe(true)
  })

  test('accepts double slash (collapsed)', () => {
    const r = ok('app://local//worker.min.js')
    expect(r.ok).toBe(true)
  })
})

describe('resolveAppUrlToFilePath - rejects paths outside whitelist', () => {
  test('rejects file at root not whitelisted', () => {
    const r = ok('app://local/malicious.js')
    expect(r.ok).toBe(false)
  })

  test('rejects arbitrary subdirectory', () => {
    const r = ok('app://local/etc/passwd')
    expect(r.ok).toBe(false)
  })

  test('rejects legitimate prefix + bypass subpath', () => {
    const r = ok('app://local/core/../../Windows/System32/exploit.dll')
    expect(r.ok).toBe(false)
  })

  test('rejects lang-data bypass with ..', () => {
    const r = ok('app://local/lang-data/../../../etc/passwd')
    expect(r.ok).toBe(false)
  })
})
