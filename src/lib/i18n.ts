/**
 * 极简 i18n 模块。
 *
 * 设计目标：
 * 1. 不引入第三方 i18n 库（项目当前未用 react-i18next 等）
 * 2. 集中所有用户可见的中文消息，便于：
 *    - 后续切换到 react-i18next / i18next
 *    - 提取到独立语言包
 *    - 添加英文等其他语言
 * 3. 默认返回中文，不改变当前用户体验
 *
 * 使用方式：
 *   import { t, ErrorCode } from '@/lib/i18n'
 *   throw new Error(t(ErrorCode.FILE_NOT_FOUND))
 *   toast.error(`${t('errorPrefix.compress')}：${t(ErrorCode.FILE_TOO_LARGE)}`)
 *
 * 错误码枚举（替代散落在各 hook 的中文字符串）：
 *   ErrorCode.FILE_NOT_FOUND → '文件不存在'
 *   ErrorCode.FILE_DATA_MISSING → '文件数据已丢失，请重新添加该文件'
 *   ...
 *
 * 注：完整 374+ 处翻译的剩余工作按以下顺序推进（不在本次 PR 范围）：
 *   - Phase 0.1 (本次)：基础设施 + 关键 5 个 hook 改造作为示范
 *   - Phase 0.2：其余 hook 与面板 toast 调用改造
 *   - Phase 0.3：英文翻译表 + 语言切换 UI
 */

/**
 * 错误码枚举。所有 throw new Error 优先使用这些常量，便于 i18n 抽取。
 */
export const ErrorCode = {
  // 通用
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_DATA_MISSING: 'FILE_DATA_MISSING',
  INVALID_PDF: 'INVALID_PDF',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  CANCELLED: 'CANCELLED',
  OPERATION_FAILED: 'OPERATION_FAILED',

  // 加密
  NEED_PASSWORD: 'NEED_PASSWORD',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  NEED_AT_LEAST_ONE_PASSWORD: 'NEED_AT_LEAST_ONE_PASSWORD',
  INVALID_ENCRYPT_PATH: 'INVALID_ENCRYPT_PATH',

  // 签名
  SIGNATURE_OUT_OF_PAGE: 'SIGNATURE_OUT_OF_PAGE',
  PDF_HAS_JAVASCRIPT: 'PDF_HAS_JAVASCRIPT',
  INVALID_SIGNATURE_PATH: 'INVALID_SIGNATURE_PATH',
  INVALID_SIGNATURE_IMAGE: 'INVALID_SIGNATURE_IMAGE',
  UNSUPPORTED_SIGNATURE_IMAGE: 'UNSUPPORTED_SIGNATURE_IMAGE',
  PAGE_INDEX_OUT_OF_RANGE: 'PAGE_INDEX_OUT_OF_RANGE',

  // Word 转换
  WORD_TOO_LARGE: 'WORD_TOO_LARGE',
  INVALID_WORD_DATA: 'INVALID_WORD_DATA',
  WORD_PARSE_FAILED: 'WORD_PARSE_FAILED',
  PDF_GENERATE_FAILED: 'PDF_GENERATE_FAILED',
  INVALID_MAMMOTH: 'INVALID_MAMMOTH',

  // 水印 / 注释
  IMAGE_READ_FAILED: 'IMAGE_READ_FAILED',
  UNSUPPORTED_IMAGE_FORMAT: 'UNSUPPORTED_IMAGE_FORMAT',
  FONT_READ_FAILED: 'FONT_READ_FAILED',
  SYSTEM_FONT_NOT_INSTALLED: 'SYSTEM_FONT_NOT_INSTALLED',
  WATERMARK_TILE_LIMIT: 'WATERMARK_TILE_LIMIT',
  WATERMARK_GAP_TOO_SMALL: 'WATERMARK_GAP_TOO_SMALL',
  ANNOTATION_NOT_FOUND: 'ANNOTATION_NOT_FOUND',
  ANNOTATION_PAGE_OUT_OF_BOUNDS: 'ANNOTATION_PAGE_OUT_OF_BOUNDS',

  // 页面
  CANNOT_DELETE_ALL_PAGES: 'CANNOT_DELETE_ALL_PAGES',
  NO_PAGES_TO_PROCESS: 'NO_PAGES_TO_PROCESS',
  EMPTY_RANGE: 'EMPTY_RANGE',
  PAGE_RANGE_INVALID: 'PAGE_RANGE_INVALID',

  // 压缩
  COMPRESS_FAILED: 'COMPRESS_FAILED',

  // 杂项
  PDF_FORMAT_REQUIRED: 'PDF_FORMAT_REQUIRED',
  ENCRYPT_RESULT_EMPTY: 'ENCRYPT_RESULT_EMPTY',
  DECRYPT_RESULT_EMPTY: 'DECRYPT_RESULT_EMPTY',
  CANVAS_CONTEXT_FAILED: 'CANVAS_CONTEXT_FAILED',
  WORD_RESULT_EMPTY: 'WORD_RESULT_EMPTY',
  INVALID_PDF_HEADER: 'INVALID_PDF_HEADER',

  // 面板
  PDF_ENCRYPTED_CANNOT_PREVIEW: 'PDF_ENCRYPTED_CANNOT_PREVIEW',
  PDF_ENCRYPTED_CANNOT_EDIT: 'PDF_ENCRYPTED_CANNOT_EDIT',
  SIGNATURE_CANVAS_NOT_READY: 'SIGNATURE_CANVAS_NOT_READY',
  SIGNATURE_CONTEXT_UNAVAILABLE: 'SIGNATURE_CONTEXT_UNAVAILABLE',
  SIGNATURE_NOT_DRAWN: 'SIGNATURE_NOT_DRAWN',
  SIGNATURE_FORMAT_PNG_JPG: 'SIGNATURE_FORMAT_PNG_JPG',
  SIGNATURE_IMAGE_TOO_LARGE: 'SIGNATURE_IMAGE_TOO_LARGE',
  SIGNATURE_INVALID_IMAGE: 'SIGNATURE_INVALID_IMAGE',
  SIGNATURE_DECODE_FAILED: 'SIGNATURE_DECODE_FAILED',
  SIGNATURE_WIDTH_OUT_OF_RANGE: 'SIGNATURE_WIDTH_OUT_OF_RANGE',
  SIGNATURE_HEIGHT_OUT_OF_RANGE: 'SIGNATURE_HEIGHT_OUT_OF_RANGE',
  PAGE_SIZE_FETCH_FAILED: 'PAGE_SIZE_FETCH_FAILED',
  ANNOTATION_NOT_ADDED: 'ANNOTATION_NOT_ADDED',
  NO_PDF_SELECTED: 'NO_PDF_SELECTED',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * 中文翻译表。
 * Key 格式：可使用 ErrorCode.* 常量或任意 dot-separated 路径。
 */
const messages: Record<string, string> = {
  // 通用
  [ErrorCode.FILE_NOT_FOUND]: '文件不存在',
  [ErrorCode.FILE_DATA_MISSING]: '文件数据已丢失，请重新添加该文件',
  [ErrorCode.INVALID_PDF]: '不是有效的PDF文档',
  [ErrorCode.INVALID_FILE_FORMAT]: '不支持的文件格式',
  [ErrorCode.CANCELLED]: '操作已取消',
  [ErrorCode.OPERATION_FAILED]: '操作失败',
  [ErrorCode.INVALID_PDF_HEADER]: '无法读取文件数据，请重新添加该文件',

  // 加密
  [ErrorCode.NEED_PASSWORD]: '请输入密码',
  [ErrorCode.WRONG_PASSWORD]: '密码错误，无法解密',
  [ErrorCode.NEED_AT_LEAST_ONE_PASSWORD]: '请至少设置用户密码或所有者密码',
  [ErrorCode.INVALID_ENCRYPT_PATH]: '加密路径不合法',

  // 签名
  [ErrorCode.SIGNATURE_OUT_OF_PAGE]: '签名超出页面范围，请调整位置或缩小签名尺寸',
  [ErrorCode.PDF_HAS_JAVASCRIPT]:
    '该PDF包含嵌入式JavaScript代码，可能存在安全风险。请使用专业PDF工具检查后再签名',
  [ErrorCode.INVALID_SIGNATURE_PATH]: '文件路径不合法，请选择有效的保存路径',
  [ErrorCode.INVALID_SIGNATURE_IMAGE]: '签名图片格式错误，请重新选择或绘制签名',
  [ErrorCode.UNSUPPORTED_SIGNATURE_IMAGE]: '不支持的签名图片格式，请使用 PNG 或 JPG 格式',
  [ErrorCode.PAGE_INDEX_OUT_OF_RANGE]: '页码超出范围，请选择有效的页码',

  // Word 转换
  [ErrorCode.WORD_TOO_LARGE]: 'Word 文档过大',
  [ErrorCode.INVALID_WORD_DATA]: 'Invalid Word data',
  [ErrorCode.WORD_PARSE_FAILED]: 'Word 文档解析失败，请检查文件格式是否正确',
  [ErrorCode.PDF_GENERATE_FAILED]: 'PDF 生成失败，请重试',
  [ErrorCode.INVALID_MAMMOTH]: 'mammoth 转换失败',

  // 水印 / 注释
  [ErrorCode.IMAGE_READ_FAILED]: '读取图片失败',
  [ErrorCode.UNSUPPORTED_IMAGE_FORMAT]: '不支持的图片格式，请使用 PNG 或 JPG 格式',
  [ErrorCode.FONT_READ_FAILED]: '读取字体失败',
  [ErrorCode.SYSTEM_FONT_NOT_INSTALLED]: '读取系统字体失败，请确保系统已安装宋体字体',
  [ErrorCode.WATERMARK_TILE_LIMIT]:
    '水印平铺数量已达上限（每页 500 个），右下角区域可能未被覆盖。请增大间距或缩小水印后重试。',
  [ErrorCode.WATERMARK_GAP_TOO_SMALL]: '水印间距过小，平铺数量超过上限',
  [ErrorCode.ANNOTATION_NOT_FOUND]: '批注不存在',

  // 页面
  [ErrorCode.ANNOTATION_PAGE_OUT_OF_BOUNDS]: '标注页码越界',
  [ErrorCode.CANNOT_DELETE_ALL_PAGES]: '不能删除文档的全部页面',
  [ErrorCode.NO_PAGES_TO_PROCESS]: '没有可处理的页面',
  [ErrorCode.EMPTY_RANGE]: '页码范围为空',
  [ErrorCode.PAGE_RANGE_INVALID]: '页码范围无效',

  // 压缩
  [ErrorCode.COMPRESS_FAILED]: '压缩失败',

  // 杂项
  [ErrorCode.PDF_FORMAT_REQUIRED]: '请选择 PDF 文件格式保存',
  [ErrorCode.ENCRYPT_RESULT_EMPTY]: '加密结果数据为空',
  [ErrorCode.DECRYPT_RESULT_EMPTY]: '解密结果数据为空',
  [ErrorCode.CANVAS_CONTEXT_FAILED]: '无法创建 Canvas 上下文',
  [ErrorCode.WORD_RESULT_EMPTY]: '转换结果为空',

  // 面板
  [ErrorCode.PDF_ENCRYPTED_CANNOT_PREVIEW]: 'PDF文件已加密，无法预览',
  [ErrorCode.PDF_ENCRYPTED_CANNOT_EDIT]: 'PDF文件已加密，无法编辑',
  [ErrorCode.SIGNATURE_CANVAS_NOT_READY]: '签名画布未就绪',
  [ErrorCode.SIGNATURE_CONTEXT_UNAVAILABLE]: '签名画布上下文不可用',
  [ErrorCode.SIGNATURE_NOT_DRAWN]: '请先绘制签名',
  [ErrorCode.SIGNATURE_FORMAT_PNG_JPG]: '仅支持PNG/JPG格式的签名图片',
  [ErrorCode.SIGNATURE_IMAGE_TOO_LARGE]: '签名图片大小不能超过5MB',
  [ErrorCode.SIGNATURE_INVALID_IMAGE]: '文件不是有效的PNG/JPG图片，请重新选择',
  [ErrorCode.SIGNATURE_DECODE_FAILED]: '图片解码失败，请选择有效的图片文件',
  [ErrorCode.SIGNATURE_WIDTH_OUT_OF_RANGE]: '签名宽度需在50px到页面宽度之间',
  [ErrorCode.SIGNATURE_HEIGHT_OUT_OF_RANGE]: '签名高度需在25px到页面高度之间',
  [ErrorCode.PAGE_SIZE_FETCH_FAILED]: '获取页面尺寸失败，请检查PDF是否有效',
  [ErrorCode.ANNOTATION_NOT_ADDED]: '请先添加标注',
  [ErrorCode.NO_PDF_SELECTED]: '请先选择PDF文件',

  // 占位符示例（仅供测试替换逻辑；实际业务可选用）
  'demo.greeting': '你好，{name}！欢迎使用 {product}。',

  // 操作前缀
  'errorPrefix.compress': '压缩失败',
  'errorPrefix.merge': '合并失败',
  'errorPrefix.split': '分割失败',
  'errorPrefix.encrypt': '加密失败',
  'errorPrefix.decrypt': '解密失败',
  'errorPrefix.watermark': '水印失败',
  'errorPrefix.pageNumber': '添加页码失败',
  'errorPrefix.signature': '签名失败',
  'errorPrefix.annotation': '添加批注失败',
  'errorPrefix.convert': '转换失败',
  'errorPrefix.ocr': 'OCR 失败',
} as const

/**
 * 翻译函数。返回中文（默认 locale）。
 * 暂不实现多语言，仅作为 i18n 抽取的中间层。
 *
 * @param key - ErrorCode.* 或 dot-separated 路径
 * @param params - 命名占位符替换（如 `{ name }` → 文件名）
 * @returns 中文消息；未知 key 返回 key 自身（便于发现漏翻）
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = (messages as Record<string, string>)[key]
  if (raw === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing translation: ${key}`)
    }
    return key
  }
  if (!params) return raw
  let msg = raw
  for (const [k, v] of Object.entries(params)) {
    msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
  }
  return msg
}

/**
 * 简化调用：传入 ErrorCode 数组，返回第一条匹配的消息。
 * 主要用于统一"白名单通过/未通过"等场景。
 */
export function tOne(...codes: ErrorCodeValue[]): string {
  const m = messages as Record<string, string>
  for (const code of codes) {
    const msg = m[code]
    if (msg) return msg
  }
  return codes[0] ?? ''
}
