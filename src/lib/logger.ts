export interface LogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info'
  message: string
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
  
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`,
    details ?? ''
  )
  
  const logs = getLogs()
  logs.push(entry)
  saveLogs(logs)
}

export const logger = {
  error(message: string, details?: unknown): void {
    addLog('error', message, details)
  },
  
  warn(message: string, details?: unknown): void {
    addLog('warn', message, details)
  },
  
  info(message: string, details?: unknown): void {
    addLog('info', message, details)
  },
  
  getLogs(): LogEntry[] {
    return getLogs()
  },
  
  clearLogs(): void {
    localStorage.removeItem(LOG_KEY)
  },
  
  exportLogs(): string {
    const logs = getLogs()
    return logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.details ? '\n  ' + JSON.stringify(log.details, null, 2) : ''}`
    ).join('\n')
  },
}
