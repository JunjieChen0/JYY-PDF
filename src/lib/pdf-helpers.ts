import { rgb } from 'pdf-lib'
import { t, ErrorCode } from './i18n'

/**
 * 将 CSS 风格的十六进制颜色字符串（如 `#ff8800` 或 `#f80`）转为 pdf-lib 的 `rgb()` 颜色。
 * @param hex - `#` 前缀可选；3 位简写会被展开为 6 位。
 * @returns pdf-lib `rgb()` 颜色对象；解析失败时回退为黑色 `(0, 0, 0)`。
 */
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
    parseInt(result[3], 16) / 255,
  )
}

const getMeasureContext = (() => {
  let ctx: CanvasRenderingContext2D | null = null
  return (): CanvasRenderingContext2D | null => {
    if (ctx) return ctx
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d')
    return ctx
  }
})()

/**
 * 估算文本渲染宽度。优先使用 `canvas.measureText` 精确测量；
 * 不可用时回退到 CJK 字符 `fontSize`、其它字符 `fontSize*0.6` 的启发式估算。
 * @param text - 待测量的文本
 * @param fontSize - 字号（px）
 * @returns 估算的像素宽度
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  const ctx = getMeasureContext()
  if (ctx) {
    ctx.font = `${fontSize}px "SimSun", "Microsoft YaHei", sans-serif`
    return ctx.measureText(text).width
  }
  let width = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0x3000 && code <= 0x303f)
    ) {
      width += fontSize
    } else {
      width += fontSize * 0.6
    }
  }
  return width
}

/**
 * 让出主线程：在下一帧（rAF）或 setTimeout(0) 时 resolve。
 * 在长循环中调用可避免 UI 冻结。
 */
export function yieldToMain() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })
}

/**
 * Electron IPC handler 的统一返回结构：`{ error: string }` 表示失败。
 */
export interface FileResult {
  error?: string
}

/**
 * 类型守卫：判断未知值是否为带 `error` 字段的对象（IPC 失败返回的形态）。
 */
export function isFileResult(result: unknown): result is FileResult {
  return typeof result === 'object' && result !== null && 'error' in result
}

/**
 * 检查 IPC 返回结果，若带 `error` 字段则抛 Error 携带前缀。
 * @param result - electronAPI 调用返回值
 * @param errorMsg - 抛错时附加的前缀（如 `'读取文件失败：'`）
 * @throws Error 消息格式：`${errorMsg}${result.error}`
 */
export function checkResult(result: unknown, errorMsg: string): void {
  if (isFileResult(result) && result.error) {
    throw new Error(`${errorMsg}${result.error}`)
  }
}

/**
 * 类型守卫：判断值是否为 `Uint8Array`。
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array
}

/**
 * 断言值为 `Uint8Array`，否则抛 Error。
 * @throws Error 携带 `errorMsg`
 */
export function assertUint8Array(value: unknown, errorMsg: string): Uint8Array {
  if (!isUint8Array(value)) {
    throw new Error(errorMsg)
  }
  return value
}

/**
 * 校验数据以 `%PDF-` 开头，缺失时抛 Error。
 * @throws Error - 头部不可读或不是合法 PDF
 */
export function validatePdfHeader(data: Uint8Array): void {
  let header: string
  try {
    header = new TextDecoder().decode(data.slice(0, 5))
  } catch {
    throw new Error(t(ErrorCode.INVALID_PDF_HEADER))
  }
  if (header !== '%PDF-') {
    throw new Error(t(ErrorCode.INVALID_PDF))
  }
}

/**
 * 标识文件数据在 pdfDataStore 中已丢失的错误。
 * 抛此错误可被外层 catch 转译为用户友好提示。
 */
export class FileDataMissingError extends Error {
  constructor(message = '文件数据已丢失，请重新添加该文件') {
    super(message)
    this.name = 'FileDataMissingError'
  }
}

/**
 * 从 pdfDataStore 取出必需的数据；缺失时抛 FileDataMissingError。
 * 替代 `getData(id)!` 这种非空断言。
 * @param id - 文件 UUID
 * @param store - 任何实现了 `getData(id): Uint8Array | undefined` 的对象
 * @throws FileDataMissingError - 当 store 中不存在该 id
 */
export function getRequiredPdfData(
  id: string,
  store: { getData(id: string): Uint8Array | undefined },
): Uint8Array {
  const data = store.getData(id)
  if (!data) {
    throw new FileDataMissingError()
  }
  return data
}
