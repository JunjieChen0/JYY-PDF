import { rgb } from 'pdf-lib'

export function hexToRgb(hex: string) {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  if (!result) {
    return rgb(0, 0, 0)
  }
  return rgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  )
}

let measureCanvas: HTMLCanvasElement | null = null
let measureCtx: CanvasRenderingContext2D | null = null

export function estimateTextWidth(text: string, fontSize: number): number {
  if (typeof document !== 'undefined') {
    if (!measureCanvas) {
      measureCanvas = document.createElement('canvas')
      measureCtx = measureCanvas.getContext('2d')
    }
    if (measureCtx) {
      measureCtx.font = `${fontSize}px "SimSun", "Microsoft YaHei", sans-serif`
      return measureCtx.measureText(text).width
    }
  }
  let width = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0x3000 && code <= 0x303F)
    ) {
      width += fontSize
    } else {
      width += fontSize * 0.6
    }
  }
  return width
}

export function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export interface FileResult {
  error?: string
}

export function isFileResult(result: unknown): result is FileResult {
  return typeof result === 'object' && result !== null && 'error' in result
}

export function checkResult(result: unknown, errorMsg: string): void {
  if (isFileResult(result) && result.error) {
    throw new Error(`${errorMsg}${result.error}`)
  }
}

export function validatePdfHeader(data: Uint8Array): void {
  try {
    const header = new TextDecoder().decode(data.slice(0, 5))
    if (header !== '%PDF-') {
      throw new Error('不是有效的PDF文档')
    }
  } catch {
    throw new Error('无法读取文件数据，请重新添加该文件')
  }
}
