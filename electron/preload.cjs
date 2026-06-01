const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, buffer) => ipcRenderer.invoke('fs:writeFile', filePath, buffer),
  fileExists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  fileStat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
  convertWordToPdf: (filePath) => ipcRenderer.invoke('convert:wordToPdf', filePath),
  encryptPdf: (options) => ipcRenderer.invoke('encrypt:encryptPdf', options),
  decryptPdf: (options) => ipcRenderer.invoke('encrypt:decryptPdf', options),
  readSystemFont: (fontName) => ipcRenderer.invoke('fs:readSystemFont', fontName),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
})
