const { app, BrowserWindow, ipcMain, dialog, session } = require('electron')
const path = require('path')
const fs = require('fs')

const allowedPaths = new Set()
const allowedOutputDirs = new Map()

function getUserDocsPath() {
  return app.getPath('documents')
}

function isPathSafe(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  if (filePath.includes('..') || filePath.match(/%2e|%252e/i)) return false
  const normalized = path.normalize(filePath)
  if (normalized.includes('..')) return false
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

const DANGEROUS_ATTRS = /\s+(?:on\w+|formaction|dynsrc|lowsrc|data-bind|v-bind|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi
const DANGEROUS_STYLE = /expression\s*\(|behavior\s*:|-moz-binding\s*:|@import\s+/gi
const DANGEROUS_URI_ATTRS = /\b(?:href|src|action|poster)\s*=\s*["']?\s*(?:javascript|vbscript|data)\s*:/gi
const SVG_SCRIPT = /<\s*\/?\s*(?:script|style|iframe|object|embed|applet|form|input|textarea|select|button)\b[^>]*>/gi
const HTML_COMMENTS = /<!--[\s\S]*?-->/g
const SELF_CLOSING_SLASH = /<(\w+)\s*\/>/g

function sanitizeHtml(html) {
  let result = html
  result = result.replace(HTML_COMMENTS, '')
  result = result.replace(SVG_SCRIPT, '')
  result = result.replace(/<\/?(\w[\w-]*)[^>]*\/?>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_HTML_TAGS.has(tag)) return ''
    let cleaned = match
    cleaned = cleaned.replace(DANGEROUS_ATTRS, '')
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
  let sanitized = input.replace(/\.\./g, '').replace(/%2e/gi, '').replace(/%252e/gi, '')
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
      webPreferences: { nodeIntegration: false, contextIsolation: true }
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
            ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:"
            : "default-src 'self' http://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; style-src 'self' 'unsafe-inline' http://localhost:*; img-src 'self' data: blob: http://localhost:*; font-src 'self' data: http://localhost:*; connect-src 'self' ws: http://localhost:*; worker-src 'self' blob: http://localhost:*"
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
    const buffer = await fs.promises.readFile(filePath)
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
