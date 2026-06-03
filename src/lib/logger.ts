/**
 * 单条日志记录。
 */
export interface LogEntry {
  /** ISO 8601 时间戳 */
  timestamp: string
  /** 日志级别 */
  level: 'error' | 'warn' | 'info'
  /** 日志消息 */
  message: string
  /** 附加详情（Error 对象会被截断为 message + stack 前 500 字符） */
  details?: unknown
}

const LOG_KEY = 'jyy_pdf_logs'
const MAX_LOGS = 200

function getLogs(): LogEntry[] {
  try {
    const stored = localStorage.getItem(LOG_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveLogs(logs: LogEntry[]): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-MAX_LOGS)))
  } catch {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-50)))
    } catch {
      console.warn('无法保存日志到本地存储')
    }
  }
}

/** 截断过大的详情数据，防止 localStorage 溢出 */
function truncateDetails(details: unknown): unknown {
  if (details instanceof Error) {
    return { message: details.message, stack: details.stack?.substring(0, 500) }
  }
  if (typeof details === 'string') {
    return details.length > 1000 ? details.substring(0, 1000) + '...' : details
  }
  try {
    const json = JSON.stringify(details)
    if (json.length > 2000) {
      return json.substring(0, 2000) + '...'
    }
    return details
  } catch {
    return '[Object]'
  }
}

function addLog(level: LogEntry['level'], message: string, details?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details: details ? truncateDetails(details) : undefined,
  }

  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`,
    details ?? '',
  )

  const logs = getLogs()
  logs.push(entry)
  saveLogs(logs)
}

/**
 * 轻量日志工具。
 *
 * - 同时输出到 console 和 localStorage
 * - localStorage 日志上限 200 条（FIFO 淘汰）
 * - 详情字段自动截断以防止存储溢出
 * - 提供导出/清除方法供调试使用
 */
export const logger = {
  /** 记录错误级别日志 */
  error(message: string, details?: unknown): void {
    addLog('error', message, details)
  },

  /** 记录警告级别日志 */
  warn(message: string, details?: unknown): void {
    addLog('warn', message, details)
  },

  /** 记录信息级别日志 */
  info(message: string, details?: unknown): void {
    addLog('info', message, details)
  },

  /** 获取所有存储的日志 */
  getLogs(): LogEntry[] {
    return getLogs()
  },

  /** 清空所有存储的日志 */
  clearLogs(): void {
    localStorage.removeItem(LOG_KEY)
  },

  /** 将日志导出为可读文本（供复制或下载） */
  exportLogs(): string {
    const logs = getLogs()
    return logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.details ? '\n  ' + JSON.stringify(log.details, null, 2) : ''}`,
      )
      .join('\n')
  },
}
