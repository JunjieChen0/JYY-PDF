import type { ElectronAPI } from '@/hooks/types'

const fallbackAPI: ElectronAPI = {
  openFile: () => Promise.resolve({ canceled: true, filePaths: [] }),
  saveFile: () => Promise.resolve({ canceled: true, filePath: '' }),
  readFile: () => Promise.resolve({ error: 'electronAPI 不可用' }),
  writeFile: () => Promise.resolve({ error: 'electronAPI 不可用' }),
  fileExists: () => Promise.resolve(false),
  checkFileExists: () => Promise.resolve(false),
  fileStat: () => Promise.resolve({ size: 0, isFile: false, isDirectory: false } as const),
  convertWordToPdf: () => Promise.resolve({ error: 'electronAPI 不可用' }),
  convertWordToPdfData: () => Promise.resolve({ error: 'electronAPI 不可用' }),
  encryptPdf: () => Promise.resolve({ error: 'electronAPI 不可用' }),
  decryptPdf: () => Promise.resolve({ error: 'electronAPI 不可用' }),
  readSystemFont: () => Promise.resolve({ error: 'electronAPI 不可用' }),
  getPathForFile: () => '',
  getAppPath: () => '',
}

export function ensureElectronAPI(): void {
  if (typeof window !== 'undefined' && !window.electronAPI) {
    window.electronAPI = fallbackAPI
  }
}
