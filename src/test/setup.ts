import '@testing-library/jest-dom/vitest'
import type { ElectronAPI } from '@/hooks/types'

if (typeof window !== 'undefined' && !window.electronAPI) {
  const fallback: ElectronAPI = {
    openFile: () => Promise.resolve({ canceled: true, filePaths: [] }),
    saveFile: () => Promise.resolve({ canceled: true, filePath: '' }),
    readFile: () => Promise.resolve({ error: 'electronAPI 不可用' }),
    writeFile: () => Promise.resolve({ error: 'electronAPI 不可用' }),
    fileExists: () => Promise.resolve(false),
    fileStat: () =>
      Promise.resolve({ error: 'electronAPI 不可用' } as unknown as {
        size: number
        isFile: boolean
        isDirectory: boolean
      }),
    convertWordToPdf: () => Promise.resolve({ error: 'electronAPI 不可用' }),
    convertWordToPdfData: () => Promise.resolve({ error: 'electronAPI 不可用' }),
    encryptPdf: () => Promise.resolve({ error: 'electronAPI 不可用' }),
    decryptPdf: () => Promise.resolve({ error: 'electronAPI 不可用' }),
    readSystemFont: () => Promise.resolve({ error: 'electronAPI 不可用' }),
    getPathForFile: () => '',
  }
  window.electronAPI = fallback
}
