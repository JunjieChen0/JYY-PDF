const { app, BrowserWindow, ipcMain, dialog, session, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const crypto = require('crypto')
const dompurify = require('isomorphic-dompurify')
const pathSafety = require('./lib/path-safety')
const { resolveAppUrlToFilePath } = require('./lib/app-protocol')

const pathRegistry = pathSafety.createPathRegistry()

const MAX_WORD_INPUT_SIZE = 50 * 1024 * 1024
const MAX_WRITE_SIZE = 500 * 1024 * 1024
const MAX_READ_SIZE = 200 * 1024 * 1024

function getUserDocsPath() {
  return app.getPath('documents')
}

const isPathSafe = pathSafety.isPathSafe
const isPathAllowed = (filePath, mode) => pathSafety.isPathAllowed(filePath, mode, pathRegistry)
const sanitizeDefaultPath = pathSafety.sanitizeDefaultPath
const sanitizeError = pathSafety.sanitizeError

// 检查文件是否是符号链接
async function isSymlink(filePath) {
  try {
    const stat = await fs.promises.lstat(filePath)
    return stat.isSymbolicLink()
  } catch {
    return false
  }
}

const ALLOWED_HTML_TAGS = new Set([
  'p',
  'br',
  'hr',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'colgroup',
  'col',
  'img',
  'a',
  'span',
  'div',
  'blockquote',
  'pre',
  'code',
  'figure',
  'figcaption',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
])

function sanitizeHtml(html) {
  return dompurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_HTML_TAGS],
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'width',
      'height',
      'colspan',
      'rowspan',
      'align',
      'valign',
      'border',
      'cellpadding',
      'cellspacing',
      'scope',
      'class',
      'id',
      'style',
      'type',
      'start',
      'reversed',
      'value',
      'headers',
      'abbr',
      'download',
      'target',
      'loading',
      'decoding',
      'sizes',
      'srcset',
      'span',
      'bgcolor',
      'color',
      'face',
      'size',
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: [
      'style',
      'script',
      'iframe',
      'object',
      'embed',
      'applet',
      'form',
      'input',
      'textarea',
      'select',
      'button',
      'svg',
      'math',
      'marquee',
      'base',
      'link',
      'meta',
    ],
    FORBID_ATTR: [
      'onfocus',
      'onblur',
      'onchange',
      'onclick',
      'ondblclick',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'onmousedown',
      'onmousemove',
      'onmouseout',
      'onmouseover',
      'onmouseup',
      'onreset',
      'onselect',
      'onsubmit',
      'onload',
      'onerror',
      'formaction',
      'xlink:href',
    ],
  })
}

async function wordBufferToPdfBuffer(wordBuffer) {
  let win = null
  try {
    if (wordBuffer.length > MAX_WORD_INPUT_SIZE) {
      throw new Error(`Word 文档过大（最大 ${MAX_WORD_INPUT_SIZE / 1024 / 1024}MB）`)
    }
    const mammoth = require('mammoth')
    const result = await mammoth.convertToHtml({ buffer: wordBuffer })
    const html = result.value

    const sanitizedHtml = sanitizeHtml(html)

    win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webgl: false,
        enableWebSQL: false,
      },
    })

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;"><style>
      body { font-family: 'Microsoft YaHei', 'SimSun', Arial, sans-serif; font-size: 14px; line-height: 1.6; padding: 40px; margin: 0; color: #333; }
      table { border-collapse: collapse; width: 100%; margin: 16px 0; }
      td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #f5f5f5; font-weight: bold; }
      img { max-width: 100%; height: auto; }
      p { margin: 8px 0; }
      h1, h2, h3, h4, h5, h6 { margin: 16px 0 8px; }
      ul, ol { padding-left: 24px; }
    </style></head><body>${sanitizedHtml}</body></html>`

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    })

    return new Uint8Array(pdfData)
  } finally {
    if (win) win.destroy()
  }
}

function getTesseractRoot() {
  const appPath = app.getAppPath()
  const unpacked = appPath.replace(/\.asar$/, '.asar.unpacked')
  return path.join(unpacked, 'dist', 'tesseract')
}

ipcMain.handle('tesseract:getPaths', async () => {
  const tesseractRoot = getTesseractRoot()
  // Use path.relative so the URL stays inside tesseract root, avoiding absolute
  // drive-letter prefixes (e.g. C:/) that would break protocol-handler sandboxing.
  const toAppUrl = (p) => {
    const rel = path.relative(tesseractRoot, p)
    return 'app://local/' + rel.split(path.sep).join('/')
  }
  return {
    worker: toAppUrl(path.join(tesseractRoot, 'worker.min.js')),
    coreDir: toAppUrl(path.join(tesseractRoot, 'core')) + '/',
    langDir: toAppUrl(path.join(tesseractRoot, 'lang-data')),
  }
})

ipcMain.handle('convert:wordToPdf', async (event, filePath) => {
  try {
    if (!isPathSafe(filePath)) throw new Error('Invalid file path')
    if (!isPathAllowed(filePath, 'read')) throw new Error('Access denied to this file path')
    if (await isSymlink(filePath)) throw new Error('Symbolic links are not allowed')

    const wordBuffer = await fs.promises.readFile(filePath)
    const pdfBuffer = await wordBufferToPdfBuffer(wordBuffer)
    return { data: pdfBuffer }
  } catch (error) {
    if (error.message?.includes('mammoth') || error.message?.includes('convertToHtml')) {
      return { error: 'Word 文档解析失败，请检查文件格式是否正确' }
    } else if (error.message?.includes('printToPDF')) {
      return { error: 'PDF 生成失败，请重试' }
    } else {
      console.error('Word to PDF conversion error:', error)
      return { error: sanitizeError(error, '转换失败，请检查文件是否损坏或格式是否支持') }
    }
  }
})

ipcMain.handle('convert:wordToPdfData', async (event, data) => {
  try {
    if (!data || !(data instanceof Uint8Array)) {
      throw new Error('Invalid Word data')
    }
    if (data.length > MAX_WORD_INPUT_SIZE) {
      throw new Error(`Word 文档过大（最大 ${MAX_WORD_INPUT_SIZE / 1024 / 1024}MB）`)
    }
    const pdfBuffer = await wordBufferToPdfBuffer(data)
    return { data: pdfBuffer }
  } catch (error) {
    if (error.message?.includes('mammoth') || error.message?.includes('convertToHtml')) {
      return { error: 'Word 文档解析失败，请检查文件格式是否正确' }
    } else if (error.message?.includes('printToPDF')) {
      return { error: 'PDF 生成失败，请重试' }
    } else {
      console.error('Word to PDF (data) conversion error:', error)
      return { error: sanitizeError(error, '转换失败，请检查文件是否损坏或格式是否支持') }
    }
  }
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'JYY PDF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    icon: path.join(__dirname, '../public/icon.ico'),
  })

  win.on('closed', () => {
    pathRegistry.clear()
  })

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
    win.setMenu(null)
  }
}

// tesseract asset paths are now resolved at runtime via IPC using file:// URLs.

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
])

app.whenReady().then(() => {
  const tesseractRoot = getTesseractRoot()

  protocol.handle('app', async (request) => {
    const result = resolveAppUrlToFilePath(request.url, tesseractRoot)
    if (!result.ok) {
      return new Response('forbidden', { status: result.status })
    }
    let real
    try {
      real = await fs.promises.realpath(result.filePath)
    } catch {
      return new Response('not found', { status: 404 })
    }
    const rootResolved = path.resolve(tesseractRoot)
    if (!real.startsWith(rootResolved + path.sep) && real !== rootResolved) {
      return new Response('forbidden', { status: 403 })
    }
    return net.fetch('file:///' + real.replace(/\\/g, '/'))
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          app.isPackaged
            ? "default-src 'self' app:; script-src 'self' app:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: app:; font-src 'self' data:; connect-src 'self' app:; worker-src 'self' blob: app:"
            : "default-src 'self' http://localhost:* app:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* app:; style-src 'self' 'unsafe-inline' http://localhost:*; img-src 'self' data: blob: http://localhost:* app:; font-src 'self' data: http://localhost:*; connect-src 'self' ws: http://localhost:* app:; worker-src 'self' blob: http://localhost:* app:",
        ],
      },
    })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('dialog:openFile', async (event, options) => {
  const safeDefaultPath = sanitizeDefaultPath(options?.defaultPath) || getUserDocsPath()
  const safeOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: safeDefaultPath,
  }
  const result = await dialog.showOpenDialog(safeOptions)
  if (!result.canceled && result.filePaths.length > 0) {
    result.filePaths.forEach((filePath) => {
      pathRegistry.add(filePath)
    })
  }
  return result
})

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const safeFileName = sanitizeDefaultPath(options?.defaultPath)
  const safeOptions = {
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: safeFileName ? path.join(getUserDocsPath(), safeFileName) : getUserDocsPath(),
  }
  const result = await dialog.showSaveDialog(safeOptions)
  if (!result.canceled && result.filePath) {
    pathRegistry.add(result.filePath)
  }
  return result
})

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    if (!isPathSafe(filePath)) {
      throw new Error('Invalid file path')
    }
    if (!isPathAllowed(filePath, 'read')) {
      throw new Error('Access denied to this file path')
    }
    if (await isSymlink(filePath)) {
      throw new Error('Symbolic links are not allowed')
    }
    const stat = await fs.promises.stat(filePath)
    if (stat.size > MAX_READ_SIZE) {
      throw new Error(`File too large (max ${MAX_READ_SIZE / 1024 / 1024}MB)`)
    }
    const buffer = await fs.promises.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.pdf' && buffer.length >= 5) {
      const header = buffer.slice(0, 5).toString('ascii')
      if (header !== '%PDF-') {
        throw new Error('Not a valid PDF file')
      }
    }
    if (['.png', '.jpg', '.jpeg'].includes(ext) && buffer.length >= 4) {
      const magic = buffer.slice(0, 4)
      const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47
      const isJpg = magic[0] === 0xff && magic[1] === 0xd8
      if (!isPng && !isJpg) {
        throw new Error('Not a valid image file')
      }
    }
    return buffer
  } catch (error) {
    return { error: sanitizeError(error, '文件读取失败') }
  }
})

ipcMain.handle('fs:writeFile', async (event, filePath, buffer) => {
  try {
    if (!isPathSafe(filePath)) {
      throw new Error('Invalid file path')
    }
    if (!isPathAllowed(filePath, 'write')) {
      throw new Error('Access denied to this file path')
    }
    if (await isSymlink(filePath)) {
      throw new Error('Symbolic links are not allowed')
    }
    const data = Buffer.from(buffer || [])
    if (data.length > MAX_WRITE_SIZE) {
      throw new Error(`写入内容过大（最大 ${MAX_WRITE_SIZE / 1024 / 1024}MB）`)
    }
    const dir = path.dirname(filePath)
    await fs.promises.mkdir(dir, { recursive: true })
    await fs.promises.writeFile(filePath, data)
    return true
  } catch (error) {
    return { error: sanitizeError(error, '文件写入失败') }
  }
})

ipcMain.handle('fs:exists', async (event, filePath) => {
  try {
    if (!isPathSafe(filePath)) {
      return false
    }
    if (!isPathAllowed(filePath, 'read')) {
      return false
    }
    if (await isSymlink(filePath)) {
      return false
    }
    return fs.promises
      .stat(filePath)
      .then(() => true)
      .catch(() => false)
  } catch {
    return false
  }
})

ipcMain.handle('fs:registerPath', async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return false
    if (!isPathSafe(filePath)) return false
    pathRegistry.add(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('fs:readSystemFont', async (event, fontName) => {
  try {
    const platform = process.platform
    const fontPaths = {
      simsun:
        platform === 'win32'
          ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'STSONG.TTF')
          : platform === 'darwin'
            ? '/System/Library/Fonts/STSong.ttf'
            : '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf',
      msyh:
        platform === 'win32'
          ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'STXIHEI.TTF')
          : platform === 'darwin'
            ? '/System/Library/Fonts/PingFang.ttc'
            : '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf',
    }
    const fontPath = fontPaths[fontName]
    if (!fontPath) {
      return { error: `字体文件不存在: ${fontName}` }
    }
    try {
      await fs.promises.access(fontPath)
    } catch {
      return { error: `字体文件不存在: ${fontName}` }
    }
    let buffer = await fs.promises.readFile(fontPath)
    if (buffer.length >= 4 && buffer.slice(0, 4).toString('ascii') === 'ttcf') {
      const fontkit = require('@pdf-lib/fontkit')
      const ttc = fontkit.create(buffer)
      const offsets = [...ttc.header.offsets].sort((a, b) => a - b)
      const start = offsets[0]
      const end = offsets[1] != null ? offsets[1] : buffer.length
      buffer = buffer.subarray(start, end)
    }
    return buffer
  } catch (error) {
    return { error: sanitizeError(error, '系统字体加载失败') }
  }
})

ipcMain.handle('fs:stat', async (event, filePath) => {
  try {
    if (!isPathSafe(filePath)) {
      throw new Error('Invalid file path')
    }
    if (!isPathAllowed(filePath, 'read')) {
      throw new Error('Access denied to this file path')
    }
    if (await isSymlink(filePath)) {
      throw new Error('Symbolic links are not allowed')
    }
    const stat = await fs.promises.stat(filePath)
    return {
      size: stat.size,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
    }
  } catch (error) {
    return { error: sanitizeError(error, '获取文件信息失败') }
  }
})

function getQpdfPath() {
  const binDir = app.isPackaged
    ? __dirname.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
    : __dirname
  const exeName = process.platform === 'win32' ? 'qpdf.exe' : 'qpdf'
  return path.join(binDir, 'bin', 'qpdf', exeName)
}

function sanitizePassword(pwd) {
  if (typeof pwd !== 'string') return ''
  return pwd.replace(/[\x00-\x1f]/g, '').slice(0, 256) // eslint-disable-line no-control-regex
}

function runQpdf(args, password, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(getQpdfPath(), args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`qpdf 操作超时（${timeoutMs / 1000}秒）`))
    }, timeoutMs)
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr.trim() || `qpdf 退出码 ${code}`))
      }
    })
    if (password !== undefined && password !== null) {
      try {
        child.stdin.write(password + '\n')
      } catch (err) {
        // 子进程可能已关闭（超时/崩溃）；保证不触发 unhandled
        if (!settled) {
          settled = true
          clearTimeout(timer)
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }
    try {
      child.stdin.end()
    } catch {
      // 同上：stdin 可能已关闭，忽略
    }
  })
}

ipcMain.handle('encrypt:encryptPdf', async (event, options) => {
  const tmpDir = app.getPath('temp')
  const inputPath = path.join(tmpDir, `qpdf-in-${crypto.randomUUID()}.pdf`)
  const outputPath = path.join(tmpDir, `qpdf-out-${crypto.randomUUID()}.pdf`)

  try {
    if (!options || typeof options !== 'object') throw new Error('Invalid options')
    if (!options.data || !(options.data instanceof Uint8Array)) throw new Error('Invalid PDF data')
    if (!options.userPassword && !options.ownerPassword)
      throw new Error('请至少设置用户密码或所有者密码')

    const keyLength = options.keyLength || 256
    if (![128, 256].includes(keyLength)) throw new Error('不支持的密钥长度')
    const userPassword = sanitizePassword(options.userPassword || '')
    const ownerPassword = sanitizePassword(options.ownerPassword || '')

    await fs.promises.writeFile(inputPath, Buffer.from(options.data))

    const args = ['--encrypt']
    if (userPassword) args.push(`--user-password=${userPassword}`)
    if (ownerPassword) args.push(`--owner-password=${ownerPassword}`)
    args.push(`--bits=${keyLength}`)

    if (options.restrictions) {
      if (options.restrictions.print) args.push(`--print=${options.restrictions.print}`)
      if (options.restrictions.modify) args.push(`--modify=${options.restrictions.modify}`)
      if (options.restrictions.extract) args.push(`--extract=${options.restrictions.extract}`)
      if (options.restrictions.accessibility === 'n') args.push('--accessibility=n')
      if (keyLength === 128 && options.restrictions.useAes === 'y') args.push('--use-aes=y')
      if (keyLength === 256 && options.restrictions.forceR5 === 'y') args.push('--force-R5')
    }

    args.push('--')
    args.push(inputPath, outputPath)

    await runQpdf(args)

    const result = await fs.promises.readFile(outputPath)
    return { data: new Uint8Array(result) }
  } catch (error) {
    return { error: sanitizeError(error, '加密失败') }
  } finally {
    try {
      await fs.promises.unlink(inputPath)
    } catch {}
    try {
      await fs.promises.unlink(outputPath)
    } catch {}
  }
})

ipcMain.handle('encrypt:decryptPdf', async (event, options) => {
  const tmpDir = app.getPath('temp')
  const inputPath = path.join(tmpDir, `qpdf-in-${crypto.randomUUID()}.pdf`)
  const outputPath = path.join(tmpDir, `qpdf-out-${crypto.randomUUID()}.pdf`)

  try {
    if (!options || typeof options !== 'object') throw new Error('Invalid options')
    if (!options.data || !(options.data instanceof Uint8Array)) throw new Error('Invalid PDF data')
    if (!options.password) throw new Error('请输入密码')

    const password = sanitizePassword(options.password)
    await fs.promises.writeFile(inputPath, Buffer.from(options.data))

    const args = ['--decrypt', '--password=-', '--', inputPath, outputPath]

    try {
      await runQpdf(args, password)
    } catch (err) {
      const msg = (err && err.message) || ''
      if (/invalid\s*password|password/i.test(msg)) {
        return { error: '密码错误，无法解密' }
      }
      throw err
    }

    const result = await fs.promises.readFile(outputPath)
    return { data: new Uint8Array(result) }
  } catch (error) {
    return { error: sanitizeError(error, '解密失败') }
  } finally {
    try {
      await fs.promises.unlink(inputPath)
    } catch {}
    try {
      await fs.promises.unlink(outputPath)
    } catch {}
  }
})
