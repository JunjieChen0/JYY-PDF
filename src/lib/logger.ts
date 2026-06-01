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

function addLog(level: LogEntry['level'], message: string, details?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
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
