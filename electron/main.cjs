const { app, BrowserWindow, ipcMain, dialog, session } = require('electron')
const path = require('path')
const fs = require('fs')

// 允许的文件路径列表，只有用户通过系统对话框选择的路径才允许读写
const allowedPaths = new Set()

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

// 检查路径是否在允许列表中
function isPathAllowed(filePath) {
  const normalized = path.normalize(filePath)
  if (allowedPaths.has(normalized)) return true
  const parentDir = path.dirname(normalized)
  for (const allowedPath of allowedPaths) {
    if (path.dirname(allowedPath) === parentDir) return true
  }
  return false
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
    if (!isPathAllowed(filePath)) throw new Error('Access denied to this file path')
    if (await isSymlink(filePath)) throw new Error('Symbolic links are not allowed')

    const mammoth = require('mammoth')
    const result = await mammoth.convertToHtml({ path: filePath })
    const html = result.value

    const sanitizedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      .replace(/<input\b[^>]*>/gi, '')
      .replace(/<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi, '')
      .replace(/<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi, '')
      .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '')
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\bon\w+\s*=\s*\S+/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      .replace(/data\s*:[^,]*script/gi, '')

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
    return { error: error.message }
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
    allowedPaths.add(path.normalize(result.filePath))
  }
  return result
})

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    if (!isPathSafe(filePath)) {
      throw new Error('Invalid file path')
    }
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied to this file path')
    }
    // 禁止读取符号链接
    if (await isSymlink(filePath)) {
      throw new Error('Symbolic links are not allowed')
    }
    const ext = path.extname(filePath).toLowerCase()
    const allowedReadExts = ['.pdf', '.png', '.jpg', '.jpeg']
    if (!allowedReadExts.includes(ext)) {
      throw new Error('File type not allowed')
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
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied to this file path')
    }
    // 禁止写入符号链接
    if (await isSymlink(filePath)) {
      throw new Error('Symbolic links are not allowed')
    }
    const ext = path.extname(filePath).toLowerCase()
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.docx', '.doc']
    if (!allowedExts.includes(ext)) {
      throw new Error('Invalid file extension')
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
    if (!isPathAllowed(filePath)) {
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
    if (!isPathAllowed(filePath)) {
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
