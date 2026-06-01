import type { FileResult } from '@/lib/pdf-helpers'

export interface PDFFile {
  id: string
  name: string
  size: number
  pageCount: number
  data: Uint8Array
}

declare global {
  interface Window {
    electronAPI: {
      openFile: (options?: object) => Promise<{ canceled: boolean; filePaths: string[] }>
      saveFile: (options?: object) => Promise<{ canceled: boolean; filePath: string }>
      readFile: (filePath: string) => Promise<Uint8Array | FileResult>
      writeFile: (filePath: string, buffer: Uint8Array) => Promise<boolean | FileResult>
      fileExists: (filePath: string) => Promise<boolean>
      fileStat: (filePath: string) => Promise<{ size: number; isFile: boolean; isDirectory: boolean }>
      convertWordToPdf: (filePath: string) => Promise<{ data?: Uint8Array; error?: string }>
    }
  }
}

export type ProgressCallback = (progress: number) => void

export type WatermarkPosition = 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'tile'

export type PageNumberPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface Annotation {
  pageIndex: number
  type: 'text' | 'rect' | 'highlight' | 'circle'
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color?: string
  opacity?: number
  fontSize?: number
}
