const { contextBridge, ipcRenderer, webUtils, app } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, buffer) => ipcRenderer.invoke('fs:writeFile', filePath, buffer),
  fileExists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  checkFileExists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  fileStat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
  convertWordToPdf: (filePath) => ipcRenderer.invoke('convert:wordToPdf', filePath),
  convertWordToPdfData: (data) => ipcRenderer.invoke('convert:wordToPdfData', data),
  encryptPdf: (options) => ipcRenderer.invoke('encrypt:encryptPdf', options),
  decryptPdf: (options) => ipcRenderer.invoke('encrypt:decryptPdf', options),
  registerPath: (filePath) => ipcRenderer.invoke('fs:registerPath', filePath),
  readSystemFont: (fontName) => ipcRenderer.invoke('fs:readSystemFont', fontName),
  getTesseractPaths: () => ipcRenderer.invoke('tesseract:getPaths'),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
  getAppPath: () => {
    try {
      // 返回应用路径，用于访问本地资源
      return process.resourcesPath || app.getAppPath()
    } catch {
      return ''
    }
  },
})
