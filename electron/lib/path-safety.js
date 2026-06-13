const path = require('path')

const ALLOWED_WRITE_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.docx', '.doc'])
const ALLOWED_READ_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.doc'])

function isPathSafe(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  if (filePath.includes('\0')) return false
  if (filePath.includes('..') || filePath.match(/%2e|%252e/i)) return false
  const normalized = path.normalize(filePath)
  if (normalized.includes('..') || normalized.includes('\0')) return false
  return true
}

function isPathAllowed(filePath, mode, registry) {
  if (!isPathSafe(filePath)) return false
  const normalized = path.normalize(filePath)
  if (!registry || typeof registry.has !== 'function') return false
  if (!registry.has(normalized)) return false
  const ext = path.extname(normalized).toLowerCase()
  if (mode === 'write' && !ALLOWED_WRITE_EXTS.has(ext)) return false
  if (mode === 'read' && !ALLOWED_READ_EXTS.has(ext)) return false
  return true
}

function sanitizeDefaultPath(input) {
  if (!input || typeof input !== 'string') return ''
  let decoded
  try {
    decoded = decodeURIComponent(input).replace(/%2e/gi, '.').replace(/%252e/gi, '.')
  } catch {
    decoded = input.replace(/%2e/gi, '.').replace(/%252e/gi, '.')
  }
  let sanitized = decoded.replace(/\.\./g, '')
  sanitized = path.normalize(sanitized)
  if (sanitized.includes('..')) return ''
  if (path.isAbsolute(sanitized)) {
    sanitized = path.basename(sanitized)
  }
  return sanitized
}

function createPathRegistry() {
  const allowed = new Set()
  return {
    add(filePath) {
      if (!filePath) return
      allowed.add(path.normalize(filePath))
    },
    has(filePath) {
      return allowed.has(path.normalize(filePath))
    },
    clear() {
      allowed.clear()
    },
    size() {
      return allowed.size
    },
  }
}

// 我们自己抛出的安全消息白名单：可直接返回
const SAFE_ERROR_MESSAGES = new Set([
  'Invalid file path',
  'Access denied to this file path',
  'Symbolic links are not allowed',
  'Not a valid PDF file',
  'Not a valid image file',
  '请至少设置用户密码或所有者密码',
  '请输入密码',
  'Invalid options',
  'Invalid PDF data',
  'Invalid Word data',
  '不支持的密钥长度',
  '密码错误，无法解密',
])

// 已知错误码 → 用户安全消息
const ERRNO_SAFE_MESSAGES = {
  EACCES: '文件访问被拒绝',
  EPERM: '操作权限不足',
  ENOENT: '文件不存在',
  EEXIST: '文件已存在',
  EISDIR: '目标是目录而非文件',
  ENOTDIR: '路径中存在非目录项',
  EMFILE: '打开的文件过多',
  ENFILE: '打开的文件过多',
  ENOSPC: '磁盘空间不足',
  EFBIG: '文件过大',
}

/**
 * 将内部错误转换为对用户/渲染进程安全的字符串。
 * - 剥离绝对路径与权限细节
 * - 映射已知 errno 至本地化安全消息
 * - 未知错误回退到 fallbackMessage
 */
function sanitizeError(error, fallbackMessage = '操作失败') {
  if (!error) return fallbackMessage
  const msg = (error && error.message) || String(error)

  if (SAFE_ERROR_MESSAGES.has(msg)) return msg

  // 保留我们自带的限额信息（包含具体限额值，不含路径）
  const sizePatterns = [
    /写入内容过大\s*[\uFF08(]最大\s*\d+\s*MB[\uFF09)]/,
    /File too large\s*[\uFF08(]max\s*\d+\s*MB[\uFF09)]/,
    /Word 文档过大\s*[\uFF08(]最大\s*\d+\s*MB[\uFF09)]/,
    /qpdf 操作超时\s*[\uFF08(]\d+秒[\uFF09)]/,
  ]
  for (const pat of sizePatterns) {
    const m = msg.match(pat)
    if (m) return m[0]
  }

  // qpdf 错误
  if (/qpdf/.test(msg)) {
    if (/invalid\s*password|password/i.test(msg)) return '密码错误，无法解密'
    if (/超时|timeout/i.test(msg)) return 'qpdf 操作超时'
    return 'qpdf 命令执行失败'
  }

  // mammoth / printToPDF
  if (/mammoth|convertToHtml/i.test(msg)) return 'Word 文档解析失败，请检查文件格式是否正确'
  if (/printToPDF/i.test(msg)) return 'PDF 生成失败，请重试'

  // 系统 errno（括号内或开头）
  const errnoMatch = msg.match(/\b(EACCES|EPERM|ENOENT|EEXIST|EISDIR|ENOTDIR|EMFILE|ENFILE|ENOSPC|EFBIG)\b/)
  if (errnoMatch) return ERRNO_SAFE_MESSAGES[errnoMatch[1]] || fallbackMessage

  // 剥离绝对路径
  const stripped = msg
    .replace(/[A-Za-z]:\\[^\s'",;)]*/g, '[路径]')
    .replace(/\/(?:home|usr|var|etc|tmp|opt|root|Users|mnt)[^\s'",;)]*/g, '[路径]')
    .replace(/file:\/\/[^\s'",;)]*/gi, '[路径]')

  // 剥离后若与原 message 不同且仍可读，使用剥离版本
  if (stripped !== msg) {
    // 去掉所有 [路径] 占位符后若仍为空（消息本身就是路径），回退到默认
    const remaining = stripped.replace(/\[路径\]/g, '').replace(/[\s:;,.-]+/g, '').trim()
    if (remaining) return stripped
  }

  return fallbackMessage
}

module.exports = {
  ALLOWED_WRITE_EXTS,
  ALLOWED_READ_EXTS,
  isPathSafe,
  isPathAllowed,
  sanitizeDefaultPath,
  createPathRegistry,
  sanitizeError,
}
