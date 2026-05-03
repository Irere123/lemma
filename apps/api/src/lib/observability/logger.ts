import { isProduction } from '@api/lib/constants'
import { addBreadcrumb, captureException, captureMessage } from './sentry'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  service: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export interface LoggerConfig {
  service: string
  minLevel: LogLevel
  enableConsole: boolean
  enableJson: boolean
  enableSentryIntegration: boolean
}

const levels: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

function createDefaultConfig(): LoggerConfig {
  let production = false

  try {
    production = isProduction()
  } catch {
    production = false
  }

  return {
    service: 'lemma-api',
    minLevel: production ? 'info' : 'debug',
    enableConsole: true,
    enableJson: production,
    enableSentryIntegration: production,
  }
}

function shouldLog(level: LogLevel, minLevel: LogLevel) {
  return levels[level] <= levels[minLevel]
}

function serializeError(error?: Error) {
  if (!error) return undefined

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  }
}

function mapToSentryLevel(level: LogLevel) {
  const map: Record<LogLevel, 'debug' | 'info' | 'warning' | 'error' | 'fatal'> = {
    debug: 'debug',
    info: 'info',
    warn: 'warning',
    error: 'error',
    fatal: 'fatal',
  }
  return map[level] || 'info'
}

export class Logger {
  private config: LoggerConfig
  private childContext: Record<string, unknown>

  constructor(config: Partial<LoggerConfig> = {}, childContext: Record<string, unknown> = {}) {
    this.config = { ...createDefaultConfig(), ...config }
    this.childContext = childContext
  }

  child(context: Record<string, unknown>): Logger {
    return new Logger(this.config, { ...this.childContext, ...context })
  }

  private sendToSentry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.config.enableSentryIntegration || !isProduction()) return

    const sentryLevel = mapToSentryLevel(level)
    const mergedContext = { ...this.childContext, ...(context || {}) }

    addBreadcrumb({
      category: 'log',
      message,
      level: sentryLevel,
      data: mergedContext,
    })

    if (level === 'error' || level === 'fatal') {
      if (error) {
        captureException(error, mergedContext)
      } else {
        captureMessage(message, sentryLevel, mergedContext)
      }
    } else if (level === 'warn') {
      captureMessage(message, sentryLevel, mergedContext)
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole || !shouldLog(entry.level, this.config.minLevel)) return

    if (this.config.enableJson) {
      console[entry.level === 'fatal' ? 'error' : entry.level](JSON.stringify(entry))
      return
    }

    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    const errorStr = entry.error ? ` | ${entry.error.name}: ${entry.error.message}` : ''
    const line = `${entry.timestamp} ${entry.level} [${entry.service}] ${entry.message}${contextStr}${errorStr}`

    console[entry.level === 'fatal' ? 'error' : entry.level](line)
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.config.service,
      context: { ...this.childContext, ...(context || {}) },
      error: serializeError(error),
    }

    this.writeToConsole(entry)
    this.sendToSentry(level, message, context, error)
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : undefined
    const ctx = error instanceof Error ? context : (error as Record<string, unknown>)
    this.log('error', message, ctx, err)
  }

  fatal(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : undefined
    const ctx = error instanceof Error ? context : (error as Record<string, unknown>)
    this.log('fatal', message, ctx, err)
  }

  time(operation: string, context?: Record<string, unknown>): () => void {
    const start = performance.now()
    this.debug(`Starting: ${operation}`, context)
    return () => {
      const duration = performance.now() - start
      this.info(`Completed: ${operation}`, {
        ...context,
        durationMs: Math.round(duration * 100) / 100,
      })
    }
  }

  request(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: Record<string, unknown>
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    this.log(level, `${method} ${path} ${statusCode}`, {
      ...context,
      method,
      path,
      statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    })
  }

  query(operation: string, durationMs: number, context?: Record<string, unknown>): void {
    const level: LogLevel = durationMs > 1000 ? 'warn' : 'debug'
    this.log(level, `DB: ${operation}`, {
      ...context,
      durationMs: Math.round(durationMs * 100) / 100,
    })
  }
}

export const logger = new Logger()
