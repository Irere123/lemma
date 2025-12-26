import { context, trace } from '@opentelemetry/api'
import * as Sentry from '@sentry/node'
import winston from 'winston'

import { isProduction } from '@api/lib/constants'
import { addBreadcrumb, captureException, captureMessage } from './sentry'

/**
 * Log Levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'


export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  service: string
  traceId?: string
  spanId?: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

/**
 * Logger Configuration
 */
export interface LoggerConfig {
  service: string
  minLevel: LogLevel
  enableConsole: boolean
  enableJson: boolean
  enableSentryIntegration: boolean
}

const defaultConfig: LoggerConfig = {
  service: 'lemma-api',
  minLevel: isProduction ? 'info' : 'debug',
  enableConsole: true,
  enableJson: isProduction,
  enableSentryIntegration: isProduction, // Only enable in production
}

/**
 * Get current trace context from OpenTelemetry
 */
function getTraceContext(): { traceId?: string; spanId?: string } {
  const activeSpan = trace.getSpan(context.active())
  if (!activeSpan) return {}
  const spanContext = activeSpan.spanContext()
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  }
}

/**
 * Custom format to add OpenTelemetry trace context
 */
const traceContextFormat = winston.format((info) => {
  const traceContext = getTraceContext()
  if (traceContext.traceId) info.traceId = traceContext.traceId
  if (traceContext.spanId) info.spanId = traceContext.spanId
  return info
})()

/**
 * Create Winston logger instance with proper transports
 */
function createWinstonLogger(config: LoggerConfig): winston.Logger {
  const transports: winston.transport[] = []

  if (config.enableConsole) {
    if (config.enableJson) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            traceContextFormat,
            winston.format.json()
          ),
        })
      )
    } else {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            traceContextFormat,
            winston.format.colorize(),
            winston.format.printf((info) => {
              const timestamp = info.timestamp as string
              const time = timestamp.split('T')[1]?.slice(0, 12) || timestamp.split(' ')[1] || ''
              const traceInfo = info.traceId ? ` [${(info.traceId as string).slice(0, 8)}]` : ''
              const contextStr = info.context ? ` ${JSON.stringify(info.context)}` : ''
              const errorStr = info.error
                ? ` | ${(info.error as { name: string; message: string }).name}: ${
                    (info.error as { name: string; message: string }).message
                  }`
                : ''
              return `${time} ${info.level} [${config.service}]${traceInfo} ${info.message}${contextStr}${errorStr}`
            })
          ),
        })
      )
    }
  }

  return winston.createLogger({
    levels: { fatal: 0, error: 1, warn: 2, info: 3, debug: 4 },
    level: config.minLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      traceContextFormat,
      winston.format.errors({ stack: true }),
      winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] })
    ),
    defaultMeta: { service: config.service },
    transports,
    exceptionHandlers: transports,
    rejectionHandlers: transports,
  })
}

/**
 * Map log level to Sentry severity level
 */
function mapToSentryLevel(level: LogLevel): Sentry.SeverityLevel {
  const map: Record<LogLevel, Sentry.SeverityLevel> = {
    debug: 'debug',
    info: 'info',
    warn: 'warning',
    error: 'error',
    fatal: 'fatal',
  }
  return map[level] || 'info'
}

/**
 * Logger class with structured logging support
 */
export class Logger {
  private config: LoggerConfig
  private childContext: Record<string, unknown>
  private winstonLogger: winston.Logger

  constructor(config: Partial<LoggerConfig> = {}, childContext: Record<string, unknown> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.childContext = childContext
    this.winstonLogger = createWinstonLogger(this.config)
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    return new Logger(this.config, { ...this.childContext, ...context })
  }

  /**
   * Send to Sentry if enabled (only in production)
   */
  private sendToSentry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.config.enableSentryIntegration || !isProduction) return

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

  /**
   * Log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    const metadata: Record<string, unknown> = { ...this.childContext, ...(context || {}) }
    if (error) {
      metadata.error = { name: error.name, message: error.message, stack: error.stack }
    }

    this.winstonLogger.log(level, message, metadata)
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
      this.info(`Completed: ${operation}`, { ...context, durationMs: Math.round(duration * 100) / 100 })
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
