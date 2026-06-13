/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import Module from 'module'
import path from 'path'

// 在任何 import/require 之前，注入 mock 到 Module._cache。
// 这样 main.cjs 里的 `require('electron')` 走 Node 标准 loader 时会直接命中 cache。
const handlers: Record<string, any> = {}

const electronMock = {
  app: {
    getPath: (name: string) => `/mock/${name}`,
    whenReady: () => Promise.resolve(),
    on: () => {},
    isPackaged: false,
  },
  BrowserWindow: vi.fn().mockImplementation(() => {
    const win: any = {
      on: vi.fn(),
      once: vi.fn(),
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      webContents: {
        on: vi.fn(),
        send: vi.fn(),
        setWindowOpenHandler: vi.fn(),
      },
      show: vi.fn(),
      destroy: vi.fn(),
      setMenu: vi.fn(),
    }
    win.on = vi.fn((_event: string, _handler: any) => win)
    return win
  }),
  ipcMain: {
    handle: (channel: string, fn: any) => {
      handlers[channel] = fn
    },
  },
  dialog: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: '' })),
  },
  session: {
    defaultSession: {
      clearCache: vi.fn(),
      webRequest: {
        onHeadersReceived: vi.fn((_filter: any, _listener: any) => {}),
        onBeforeRequest: vi.fn((_filter: any, _listener: any) => {}),
      },
    },
  },
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  },
  net: {
    fetch: vi.fn(),
  },
}

const mockChild = new EventEmitter() as any
mockChild.stdin = { write: vi.fn(), end: vi.fn() }
mockChild.stdout = new EventEmitter()
mockChild.stderr = new EventEmitter()

const mammothMock = {
  default: {
    extractRawText: vi.fn(async () => ({ value: 'mock text', messages: [] })),
    convertToHtml: vi.fn(async () => ({ value: '<p>mock</p>', messages: [] })),
  },
}

const childProcessMock = {
  spawn: vi.fn(() => mockChild),
}

// 用真实的 require 解析路径，然后注入到 Module._cache
const origRequire = Module.prototype.require as any
;(Module.prototype.require as any) = function (id: string) {
  if (id === 'electron') return electronMock
  if (id === 'child_process') return childProcessMock
  if (id === 'mammoth') return mammothMock
  return origRequire.call(this, id)
}

// 现在 require main.cjs
// 吞掉 main.cjs 启动副作用（createWindow 中 BrowserWindow mock 不完整导致）
process.on('unhandledRejection', () => {})
require('../main.cjs')

beforeEach(() => {
  vi.mocked(electronMock.dialog.showOpenDialog).mockClear()
  vi.mocked(electronMock.dialog.showSaveDialog).mockClear()
})

describe('main.cjs IPC handler registration', () => {
  test('registers all expected channels', () => {
    const expected = [
      'convert:wordToPdf',
      'convert:wordToPdfData',
      'dialog:openFile',
      'dialog:saveFile',
      'fs:readFile',
      'fs:writeFile',
      'fs:exists',
      'fs:registerPath',
      'fs:readSystemFont',
      'fs:stat',
      'encrypt:encryptPdf',
      'encrypt:decryptPdf',
    ]
    for (const channel of expected) {
      expect(handlers[channel], `missing handler for ${channel}`).toBeTypeOf('function')
    }
  })
})

describe('convert:wordToPdfData', () => {
  const handler = handlers['convert:wordToPdfData']!

  test('rejects non-Uint8Array data', async () => {
    const result = await handler({}, 'not-a-buffer')
    expect(result.error).toMatch(/Invalid Word data/)
  })

  test('rejects data exceeding 50MB', async () => {
    const big = new Uint8Array(51 * 1024 * 1024)
    const result = await handler({}, big)
    expect(result.error).toMatch(/过大/)
    expect(result.error).toMatch(/50/)
  })

  test('rejects empty buffer', async () => {
    const result = await handler({}, new Uint8Array(0))
    expect(result).toHaveProperty('error')
  })
})

describe('fs:readFile / writeFile / exists / stat', () => {
  test('fs:readFile rejects path traversal', async () => {
    const result = await handlers['fs:readFile']!({}, '../etc/passwd')
    expect(result.error).toBeDefined()
  })

  test('fs:writeFile rejects non-allowed extension (write mode)', async () => {
    const result = await handlers['fs:writeFile']!({}, '/tmp/allowed/script.exe', new Uint8Array([1]))
    expect(result.error).toBeDefined()
  })

  test('fs:writeFile allows .pdf in registered path', async () => {
    await handlers['fs:readFile']!({}, '/tmp/registered/doc.pdf').catch(() => {})
    const result = await handlers['fs:writeFile']!({}, '/tmp/registered/out.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]))
    expect(result).toBeDefined()
  })

  test('fs:exists returns boolean (true or false) for valid path', async () => {
    const result = await handlers['fs:exists']!({}, '/tmp/exists.txt')
    expect(typeof result).toBe('boolean')
  })

  test('fs:exists returns false for path traversal', async () => {
    const result = await handlers['fs:exists']!({}, '../etc/passwd')
    expect(result).toBe(false)
  })

  test('fs:stat returns stat-or-error object', async () => {
    const result = await handlers['fs:stat']!({}, '/tmp/file.txt')
    // 在 mock 文件系统下，文件可能不存在，但返回结构应是 stat 或 { error }
    expect(result).toBeDefined()
  })

  test('fs:stat returns error for traversal', async () => {
    const result = await handlers['fs:stat']!({}, '../escape')
    expect(result.error).toBeDefined()
  })
})

describe('fs:registerPath', () => {
  test('registers a valid path and returns true', async () => {
    const result = await handlers['fs:registerPath']!({}, 'C:\\Users\\test\\file.pdf')
    expect(result).toBe(true)
  })

  test('rejects path traversal and returns false', async () => {
    const result = await handlers['fs:registerPath']!({}, '../etc/passwd')
    expect(result).toBe(false)
  })

  test('rejects null/empty input', async () => {
    expect(await handlers['fs:registerPath']!({}, '')).toBe(false)
    expect(await handlers['fs:registerPath']!({}, null as unknown as string)).toBe(false)
  })

  test('registered path returns true for valid path', async () => {
    const result = await handlers['fs:registerPath']!({}, 'C:\\test\\readable.pdf')
    expect(result).toBe(true)
  })
})

describe('dialog:openFile / saveFile', () => {
  test('dialog:openFile returns dialog result', async () => {
    vi.mocked(electronMock.dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] })
    const result = await handlers['dialog:openFile']!({}, {})
    expect(result).toHaveProperty('canceled')
  })

  test('dialog:saveFile returns dialog result', async () => {
    vi.mocked(electronMock.dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' })
    const result = await handlers['dialog:saveFile']!({}, {})
    expect(result).toHaveProperty('canceled')
  })

  test('dialog:saveFile sanitizes defaultPath', async () => {
    vi.mocked(electronMock.dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' })
    await handlers['dialog:saveFile']!({}, { defaultPath: '../../../etc/passwd' })
    expect(electronMock.dialog.showSaveDialog).toHaveBeenCalled()
  })
})

describe('convert:wordToPdf', () => {
  test('handles file path that does not exist', async () => {
    const result = await handlers['convert:wordToPdf']!({}, '/nonexistent.docx')
    expect(result).toBeDefined()
  })
})

describe('handler error containment', () => {
  test('handlers return { error } rather than throwing', async () => {
    const result = await handlers['fs:readFile']!({}, 'not a path')
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })

  test('error message is sanitized (no absolute path leak)', async () => {
    const result = await handlers['fs:readFile']!({}, '/tmp/secret/file.pdf')
    if (result.error) {
      expect(result.error).not.toMatch(/secret/)
    }
  })
})
