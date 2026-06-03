import type { FileResult } from '@/lib/pdf-helpers'

export interface PDFFile {
  id: string
  name: string
  size: number
  pageCount: number
  headerHash: string
}

export interface EncryptRestrictions {
  print?: 'full' | 'low' | 'none'
  modify?: 'all' | 'annotate' | 'form' | 'assembly' | 'none'
  extract?: 'y' | 'n'
  useAes?: 'y' | 'n'
  accessibility?: 'y' | 'n'
  forceR5?: 'y' | 'n'
}

export interface EncryptOptions {
  data: Uint8Array
  userPassword: string
  ownerPassword?: string
  keyLength?: 128 | 256
  restrictions?: EncryptRestrictions
}

export interface DecryptOptions {
  data: Uint8Array
  password: string
}

export interface ElectronAPI {
  openFile: (options?: object) => Promise<{ canceled: boolean; filePaths: string[] }>
  saveFile: (options?: object) => Promise<{ canceled: boolean; filePath: string }>
  readFile: (filePath: string) => Promise<Uint8Array | FileResult>
  writeFile: (filePath: string, buffer: Uint8Array) => Promise<boolean | FileResult>
  fileExists: (filePath: string) => Promise<boolean>
  fileStat: (filePath: string) => Promise<{ size: number; isFile: boolean; isDirectory: boolean }>
  convertWordToPdf: (filePath: string) => Promise<{ data?: Uint8Array; error?: string }>
  convertWordToPdfData: (data: Uint8Array) => Promise<{ data?: Uint8Array; error?: string }>
  encryptPdf: (options: EncryptOptions) => Promise<{ data?: Uint8Array; error?: string }>
  decryptPdf: (options: DecryptOptions) => Promise<{ data?: Uint8Array; error?: string }>
  readSystemFont: (fontName: string) => Promise<Uint8Array | FileResult>
  getPathForFile: (file: File) => string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export type ProgressCallback = (progress: number) => void

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'tile'

export type PageNumberPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

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
