const { app, BrowserWindow, ipcMain, dialog, session } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')

const allowedPaths = new Set()
const allowedOutputDirs = new Map()

function getUserDocsPath() {
  return app.getPath('documents')
}

function isPathSafe(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  if (filePath.includes('\0')) return false
  if (filePath.includes('..') || filePath.match(/%2e|%252e/i)) return false
  const normalized = path.normalize(filePath)
  if (normalized.includes('..') || normalized.includes('\0')) return false
  return true
}

const ALLOWED_WRITE_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.docx', '.doc'])
const ALLOWED_READ_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg'])

function isPathAllowed(filePath, mode) {
  const normalized = path.normalize(filePath)
  if (allowedPaths.has(normalized)) return true
  const ext = path.extname(normalized).toLowerCase()
  const basename = path.basename(normalized, ext)
  const dir = path.dirname(normalized)
  const dirInfo = allowedOutputDirs.get(dir)
  if (!dirInfo) return false
  if (mode === 'write' && !ALLOWED_WRITE_EXTS.has(ext)) return false
  if (mode === 'read' && !ALLOWED_READ_EXTS.has(ext)) return false
  if (!basename.startsWith(dirInfo.prefix)) return false
  return true
}

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
  'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'img', 'a', 'span', 'div', 'blockquote', 'pre', 'code', 'figure', 'figcaption',
  'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
])

const DANGEROUS_ATTRS = /\s+[\w\-:.]*\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi
const ATTR_WHITELIST = new Set([
  'href', 'src', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan',
  'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'scope',
  'class', 'id', 'style', 'type', 'start', 'reversed', 'value',
  'colspan', 'rowspan', 'headers', 'abbr', 'download', 'target',
  'loading', 'decoding', 'sizes', 'srcset', 'usemap', 'ismap',
  'span', 'bgcolor', 'color', 'face', 'size',
])
const DANGEROUS_ATTR_NAMES = new Set([
  'onfocus', 'onblur', 'onchange', 'onclick', 'ondblclick', 'onkeydown',
  'onkeypress', 'onkeyup', 'onmousedown', 'onmousemove', 'onmouseout',
  'onmouseover', 'onmouseup', 'onreset', 'onselect', 'onsubmit', 'onload',
  'onerror', 'onunload', 'onresize', 'onscroll', 'onwheel', 'oncopy',
  'oncut', 'onpaste', 'onabort', 'oncanplay', 'oncuechange', 'ondurationchange',
  'onemptied', 'onended', 'onloadeddata', 'onloadedmetadata', 'onloadstart',
  'onpause', 'onplay', 'onplaying', 'onprogress', 'onratechange', 'onseeked',
  'onseeking', 'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange',
  'onwaiting', 'onanimationend', 'onanimationiteration', 'onanimationstart',
  'ontransitionend', 'onmessage', 'onopen', 'onclose', 'formaction',
  'dynsrc', 'lowsrc', 'data-bind', 'v-bind', 'xlink:href',
  'xmlns', 'xlink',
])
const DANGEROUS_STYLE = /expression\s*\(|behavior\s*:|-moz-binding\s*:|@import\s+|url\s*\(|-o-link\s*:|-o-replace\s*:|@charset\s+/i
const DANGEROUS_URI_ATTRS = /\b(?:href|src|action|poster)\s*=\s*["']?\s*(?:javascript|vbscript|data)\s*:/gi
const SCRIPT_TAGS = /<\s*\/?\s*(?:script|style|iframe|object|embed|applet|form|input|textarea|select|button|svg|math|marquee|base|link|meta)\b[^>]*>/gi
const HTML_COMMENTS = /<!--[\s\S]*?-->/g
const DATA_URI_SCRIPT = /\bdata\s*:\s*text\/html/gi

function sanitizeHtml(html) {
  let result = html
  result = result.replace(HTML_COMMENTS, '')
  result = result.replace(SCRIPT_TAGS, '')
  result = result.replace(DATA_URI_SCRIPT, 'data:text/plain')
  result = result.replace(/<\/?(\w[\w\-:.]*)[^>]*\/?>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!ALLOWED_HTML_TAGS.has(tag)) return ''
    let cleaned = match
    cleaned = cleaned.replace(DANGEROUS_ATTRS, (attrMatch) => {
      const eqIndex = attrMatch.indexOf('=')
      if (eqIndex === -1) return ''
      const attrName = attrMatch.substring(0, eqIndex).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      if (DANGEROUS_ATTR_NAMES.has(attrName)) return ''
      if (attrName.startsWith('on')) return ''
      if (!ATTR_WHITELIST.has(attrName)) return ''
      const val = attrMatch.substring(eqIndex + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        return ` ${attrName}=${val}`
      }
      return ` ${attrName}="${val.replace(/"/g, '&quot;')}"`
    })
    cleaned = cleaned.replace(DANGEROUS_URI_ATTRS, (m) => m.replace(/(href|src|action|poster)\s*=\s*["']?\s*(?:javascript|vbscript|data)\s*:/gi, '$1="#"'))
    cleaned = cleaned.replace(/\bstyle\s*=\s*"([^"]*)"/gi, (m, val) => {
      if (DANGEROUS_STYLE.test(val)) return ''
      return m
    })
    cleaned = cleaned.replace(/\bstyle\s*=\s*'([^']*)'/gi, (m, val) => {
      if (DANGEROUS_STYLE.test(val)) return ''
      return m
    })
    return cleaned
  })
  return result
}

function sanitizeDefaultPath(input) {
  if (!input || typeof input !== 'string') return ''
  let decoded
  try {
    decoded = decodeURIComponent(input).replace(/%2e/gi, '.').replace(/%252e/gi, '.')
  } catch {
    decoded = input.replace(/%2e/gi, '.').replace(/%252e/gi, '.')
  }
  let sanitized = decoded.replace(/\.\./g, '')
  sanitized = path.normalize(sanitized)
  if (sanitized.includes('..')) return ''
  if (path.isAbsolute(sanitized)) {
    sanitized = path.basename(sanitized)
  }
  return sanitized
}

ipcMain.handle('convert:wordToPdf', async (event, filePath) => {
  let win = null
  try {
    if (!isPathSafe(filePath)) throw new Error('Invalid file path')
    if (!isPathAllowed(filePath, 'read')) throw new Error('Access denied to this file path')
    if (await isSymlink(filePath)) throw new Error('Symbolic links are not allowed')

    const mammoth = require('mammoth')
    const result = await mammoth.convertToHtml({ path: filePath })
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
      }
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
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })

    return { data: new Uint8Array(pdfData) }
  } catch (error) {
    if (error.message?.includes('mammoth') || error.message?.includes('convertToHtml')) {
      return { error: 'Word 文档解析失败，请检查文件格式是否正确' }
    } else if (error.message?.includes('printToPDF')) {
      return { error: 'PDF 生成失败，请重试' }
    } else {
      console.error('Word to PDF conversion error:', error)
      return { error: '转换失败，请检查文件是否损坏或格式是否支持' }
    }
  } finally {
    if (win) win.destroy()
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
      devTools: !app.isPackaged,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    icon: path.join(__dirname, '../public/icon.ico'),
  })

  win.on('closed', () => {
    allowedPaths.clear()
    allowedOutputDirs.clear()
  })

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
    win.setMenu(null)
  }
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          app.isPackaged
            ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:"
            : "default-src 'self' http://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; style-src 'self' 'unsafe-inline' http://localhost:*; img-src 'self' data: blob: http://localhost:*; font-src 'self' data: http://localhost:*; connect-src 'self' ws: http://localhost:* https://cdn.jsdelivr.net; worker-src 'self' blob: http://localhost:*"
        ]
      }
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
    defaultPath: safeDefaultPath
  }
  const result = await dialog.showOpenDialog(safeOptions)
  if (!result.canceled && result.filePaths.length > 0) {
    result.filePaths.forEach(filePath => {
      allowedPaths.add(path.normalize(filePath))
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
    defaultPath: safeFileName
      ? path.join(getUserDocsPath(), safeFileName)
      : getUserDocsPath()
  }
  const result = await dialog.showSaveDialog(safeOptions)
  if (!result.canceled && result.filePath) {
    const normalized = path.normalize(result.filePath)
    allowedPaths.add(normalized)
    const ext = path.extname(normalized).toLowerCase()
    const basename = path.basename(normalized, ext)
    const dir = path.dirname(normalized)
    const prefix = basename.replace(/_[^_]*$/, '')
    allowedOutputDirs.set(dir, { prefix })
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
    if (stat.size > 200 * 1024 * 1024) {
      throw new Error('File too large (max 200MB)')
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
      const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47
      const isJpg = magic[0] === 0xFF && magic[1] === 0xD8
      if (!isPng && !isJpg) {
        throw new Error('Not a valid image file')
      }
    }
    return buffer
  } catch (error) {
    return { error: error.message }
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
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    await fs.promises.writeFile(filePath, Buffer.from(buffer))
    return true
  } catch (error) {
    return { error: error.message }
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
    return fs.existsSync(filePath)
  } catch {
    return false
  }
})

const fontkit = require('@pdf-lib/fontkit')

function sliceTtcFirstFont(buffer) {
  const ttc = fontkit.create(buffer)
  const offsets = [...ttc.header.offsets].sort((a, b) => a - b)
  const start = offsets[0]
  const end = offsets[1] != null ? offsets[1] : buffer.length
  return buffer.subarray(start, end)
}

ipcMain.handle('fs:readSystemFont', async (event, fontName) => {
  try {
    const platform = process.platform
    const fontPaths = {
      'simsun': platform === 'win32'
        ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'STSONG.TTF')
        : platform === 'darwin'
          ? '/System/Library/Fonts/STSong.ttf'
          : '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf',
      'msyh': platform === 'win32'
        ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'STXIHEI.TTF')
        : platform === 'darwin'
          ? '/System/Library/Fonts/PingFang.ttc'
          : '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf',
    }
    const fontPath = fontPaths[fontName]
    if (!fontPath || !fs.existsSync(fontPath)) {
      return { error: `字体文件不存在: ${fontName}` }
    }
    let buffer = await fs.promises.readFile(fontPath)
    if (buffer.length >= 4 && buffer.slice(0, 4).toString('ascii') === 'ttcf') {
      buffer = sliceTtcFirstFont(buffer)
    }
    return buffer
  } catch (error) {
    return { error: error.message }
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
    return { error: error.message }
  }
})

function getQpdfPath() {
  const binDir = app.isPackaged
    ? __dirname.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
    : __dirname
  return path.join(binDir, 'bin', 'qpdf', 'qpdf.exe')
}

function sanitizePassword(pwd) {
  if (typeof pwd !== 'string') return ''
  return pwd.replace(/[\x00-\x1f]/g, '').slice(0, 256)
}

ipcMain.handle('encrypt:encryptPdf', async (event, options) => {
  const tmpDir = app.getPath('temp')
  const inputPath = path.join(tmpDir, `qpdf-in-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)
  const outputPath = path.join(tmpDir, `qpdf-out-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)

  try {
    if (!options || typeof options !== 'object') throw new Error('Invalid options')
    if (!options.data || !(options.data instanceof Uint8Array)) throw new Error('Invalid PDF data')
    if (!options.userPassword && !options.ownerPassword) throw new Error('请至少设置用户密码或所有者密码')

    const keyLength = options.keyLength || 256
    if (![40, 128, 256].includes(keyLength)) throw new Error('不支持的密钥长度')
    const userPassword = sanitizePassword(options.userPassword || '')
    const ownerPassword = sanitizePassword(options.ownerPassword || '')

    await fs.promises.writeFile(inputPath, Buffer.from(options.data))

    const args = [
      '--encrypt', userPassword, ownerPassword, String(keyLength),
    ]

    if (keyLength === 128) {
      if (options.restrictions) {
        if (options.restrictions.print) args.push(`--print=${options.restrictions.print}`)
        if (options.restrictions.modify) args.push(`--modify=${options.restrictions.modify}`)
        if (options.restrictions.extract) args.push(`--extract=${options.restrictions.extract}`)
        if (options.restrictions.useAes === 'y') args.push('--use-aes=y')
        if (options.restrictions.accessibility === 'n') args.push('--accessibility=n')
      }
    } else if (keyLength === 256) {
      if (options.restrictions) {
        if (options.restrictions.print) args.push(`--print=${options.restrictions.print}`)
        if (options.restrictions.modify) args.push(`--modify=${options.restrictions.modify}`)
        if (options.restrictions.extract) args.push(`--extract=${options.restrictions.extract}`)
        if (options.restrictions.accessibility === 'n') args.push('--accessibility=n')
        if (options.restrictions.forceR5 === 'y') args.push('--force-R5')
      }
    }

    args.push('--', inputPath, outputPath)

    await new Promise((resolve, reject) => {
      execFile(getQpdfPath(), args, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          const msg = stderr?.trim() || error.message
          reject(new Error(msg))
        } else {
          resolve()
        }
      })
    })

    const result = await fs.promises.readFile(outputPath)
    return { data: new Uint8Array(result) }
  } catch (error) {
    return { error: error.message || '加密失败' }
  } finally {
    try { await fs.promises.unlink(inputPath) } catch {}
    try { await fs.promises.unlink(outputPath) } catch {}
  }
})

ipcMain.handle('encrypt:decryptPdf', async (event, options) => {
  const tmpDir = app.getPath('temp')
  const inputPath = path.join(tmpDir, `qpdf-in-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)
  const outputPath = path.join(tmpDir, `qpdf-out-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)

  try {
    if (!options || typeof options !== 'object') throw new Error('Invalid options')
    if (!options.data || !(options.data instanceof Uint8Array)) throw new Error('Invalid PDF data')
    if (!options.password) throw new Error('请输入密码')

    const password = sanitizePassword(options.password)
    await fs.promises.writeFile(inputPath, Buffer.from(options.data))

    const args = ['--decrypt', `--password=${password}`, '--', inputPath, outputPath]

    await new Promise((resolve, reject) => {
      execFile(getQpdfPath(), args, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          const msg = stderr?.trim() || error.message
          reject(new Error(msg))
        } else {
          resolve()
        }
      })
    })

    const result = await fs.promises.readFile(outputPath)
    return { data: new Uint8Array(result) }
  } catch (error) {
    if (error.message?.includes('invalid password')) {
      return { error: '密码错误，无法解密' }
    }
    return { error: error.message || '解密失败' }
  } finally {
    try { await fs.promises.unlink(inputPath) } catch {}
    try { await fs.promises.unlink(outputPath) } catch {}
  }
})
