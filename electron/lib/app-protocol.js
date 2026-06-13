const path = require('path')

const ALLOWED_TOP_LEVEL = new Set(['worker.min.js'])
const ALLOWED_DIR_PREFIXES = ['core', 'lang-data']

function decodeSafe(input) {
  if (typeof input !== 'string') return ''
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

function isWindowsPath(p) {
  return /^[A-Za-z]:[\\/]/.test(p)
}

function hasTraversalIndicator(p) {
  if (!p) return false
  if (p.includes('..')) return true
  if (/%2e|%252e/i.test(p)) return true
  if (p.includes('\0')) return true
  return false
}

function isAllowedRel(rel) {
  if (!rel) return false
  if (ALLOWED_TOP_LEVEL.has(rel)) return true
  for (const dir of ALLOWED_DIR_PREFIXES) {
    if (rel === dir) return true
    if (rel.startsWith(dir + path.sep)) return true
  }
  return false
}

function resolveAppUrlToFilePath(requestUrl, tesseractRoot) {
  if (typeof requestUrl !== 'string' || !requestUrl) {
    return { ok: false, status: 404 }
  }
  let url
  try {
    url = new URL(requestUrl)
  } catch {
    return { ok: false, status: 404 }
  }
  if (url.protocol !== 'app:') return { ok: false, status: 404 }
  if (url.host !== 'local') return { ok: false, status: 403 }

  if (hasTraversalIndicator(url.pathname) || hasTraversalIndicator(url.search)) {
    return { ok: false, status: 403 }
  }

  const decoded = decodeSafe(url.pathname)
  if (hasTraversalIndicator(decoded)) return { ok: false, status: 403 }

  let relPath = decoded.replace(/^[\\/]+/, '')
  if (isWindowsPath(relPath)) return { ok: false, status: 403 }

  const segments = relPath.split(/[\\/]+/).filter((s) => s !== '' && s !== '.')
  if (segments.length === 0) return { ok: false, status: 403 }
  if (segments.some((s) => s === '..')) return { ok: false, status: 403 }
  if (segments.some((s) => s.includes(':'))) return { ok: false, status: 403 }

  const rootResolved = path.resolve(tesseractRoot)
  const resolved = path.resolve(rootResolved, segments.join(path.sep))

  const rel = path.relative(rootResolved, resolved)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, status: 403 }
  }

  if (!isAllowedRel(rel)) return { ok: false, status: 403 }

  return { ok: true, filePath: resolved }
}

module.exports = { resolveAppUrlToFilePath, ALLOWED_TOP_LEVEL, ALLOWED_DIR_PREFIXES }
