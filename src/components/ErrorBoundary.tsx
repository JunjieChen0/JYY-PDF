import { Component, ReactNode } from 'react'
import { AlertCircle, ClipboardCopy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

type ErrorReporter = (payload: {
  error: Error
  errorInfo: React.ErrorInfo
  componentStack?: string
  timestamp: string
}) => void | Promise<void>

const defaultReporters: ErrorReporter[] = []

export function registerErrorReporter(reporter: ErrorReporter): () => void {
  defaultReporters.push(reporter)
  return () => {
    const idx = defaultReporters.indexOf(reporter)
    if (idx >= 0) defaultReporters.splice(idx, 1)
  }
}

async function dispatchReporters(payload: {
  error: Error
  errorInfo: React.ErrorInfo
  componentStack?: string
  timestamp: string
}): Promise<void> {
  for (const reporter of defaultReporters) {
    try {
      await reporter(payload)
    } catch (err) {
      logger.warn('Error reporter threw', err)
    }
  }
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: ErrorReporter
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  copied: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, copied: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, copied: false }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const payload = {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack ?? undefined,
      timestamp: new Date().toISOString(),
    }
    logger.error('ErrorBoundary caught an error', payload)
    if (this.props.onError) {
      try {
        void this.props.onError(payload)
      } catch (err) {
        logger.warn('Custom onError reporter threw', err)
      }
    }
    void dispatchReporters(payload)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false })
  }

  handleCopy = async () => {
    const { error } = this.state
    if (!error) return
    const text = [
      `[${new Date().toISOString()}] ${error.name || 'Error'}: ${error.message}`,
      error.stack || '(no stack)',
    ].join('\n')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      this.setState({ copied: true })
    } catch (err) {
      logger.warn('复制错误信息失败', err)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">出现错误</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            {this.state.error?.message || '发生了未知错误'}
          </p>
          <div className="flex gap-2">
            <Button onClick={this.handleReset}>重试</Button>
            <Button variant="outline" onClick={this.handleCopy}>
              {this.state.copied ? (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  已复制
                </>
              ) : (
                <>
                  <ClipboardCopy className="mr-1 h-4 w-4" />
                  复制错误信息
                </>
              )}
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
