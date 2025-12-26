import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  type Span,
  type Tracer,
  type SpanOptions,
  type Context,
} from '@opentelemetry/api'
import * as Sentry from '@sentry/node'

/**
 * Get the default tracer
 */
export function getTracer(name = 'lemma-api'): Tracer {
  return trace.getTracer(name)
}

/**
 * Get the currently active span
 */
export function getActiveSpan(): Span | undefined {
  return trace.getSpan(context.active())
}

/**
 * Get the current trace ID
 */
export function getTraceId(): string | undefined {
  const span = getActiveSpan()
  return span?.spanContext().traceId
}

/**
 * Get the current span ID
 */
export function getSpanId(): string | undefined {
  const span = getActiveSpan()
  return span?.spanContext().spanId
}

/**
 * Span configuration options
 */
export interface SpanConfig {
  name: string
  op?: string
  kind?: SpanKind
  attributes?: Record<string, string | number | boolean>
}

/**
 * Start a new span and run a function within it
 * Automatically ends the span when the function completes
 */
export async function withSpan<T>(config: SpanConfig, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = getTracer()

  const options: SpanOptions = {
    kind: config.kind || SpanKind.INTERNAL,
    attributes: config.attributes,
  }

  return tracer.startActiveSpan(config.name, options, async (span) => {
    if (config.op) {
      span.setAttribute('operation', config.op)
    }

    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      })

      if (error instanceof Error) {
        span.recordException(error)
        Sentry.captureException(error)
      }

      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Start a new span synchronously
 */
export function withSpanSync<T>(config: SpanConfig, fn: (span: Span) => T): T {
  const tracer = getTracer()

  const options: SpanOptions = {
    kind: config.kind || SpanKind.INTERNAL,
    attributes: config.attributes,
  }

  return tracer.startActiveSpan(config.name, options, (span) => {
    if (config.op) {
      span.setAttribute('operation', config.op)
    }

    try {
      const result = fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      })

      if (error instanceof Error) {
        span.recordException(error)
      }

      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = getActiveSpan()
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value)
    })
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = getActiveSpan()
  if (span) {
    span.addEvent(name, attributes)
  }
}

/**
 * Set the current span status
 */
export function setSpanStatus(code: SpanStatusCode, message?: string): void {
  const span = getActiveSpan()
  if (span) {
    span.setStatus({ code, message })
  }
}

/**
 * Record an exception on the current span
 */
export function recordException(error: Error): void {
  const span = getActiveSpan()
  if (span) {
    span.recordException(error)
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    })
  }
}

/**
 * Create a database span
 */
export async function withDatabaseSpan<T>(
  operation: string,
  table: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    {
      name: `db.${operation}`,
      op: 'db.query',
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.operation': operation,
        'db.table': table,
      },
    },
    fn
  )
}

/**
 * Create an HTTP client span
 */
export async function withHttpClientSpan<T>(
  method: string,
  url: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const parsedUrl = new URL(url)

  return withSpan(
    {
      name: `HTTP ${method} ${parsedUrl.pathname}`,
      op: 'http.client',
      kind: SpanKind.CLIENT,
      attributes: {
        'http.method': method,
        'http.url': url,
        'http.host': parsedUrl.host,
        'http.scheme': parsedUrl.protocol.replace(':', ''),
      },
    },
    async (span) => {
      const result = await fn(span)
      return result
    }
  )
}

/**
 * Create a job/task span
 */
export async function withJobSpan<T>(
  jobName: string,
  jobId: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    {
      name: `job.${jobName}`,
      op: 'job.execute',
      kind: SpanKind.CONSUMER,
      attributes: {
        'job.name': jobName,
        'job.id': jobId,
      },
    },
    fn
  )
}

/**
 * Create a cache span
 */
export async function withCacheSpan<T>(
  operation: 'get' | 'set' | 'delete',
  key: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    {
      name: `cache.${operation}`,
      op: 'cache',
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.operation': operation,
        'cache.key': key,
      },
    },
    async (span) => {
      const result = await fn(span)
      const hit = result !== null && result !== undefined
      span.setAttribute('cache.hit', operation === 'get' ? hit : false)
      return result
    }
  )
}

/**
 * Create a GraphQL resolver span
 */
export async function withResolverSpan<T>(
  typeName: string,
  fieldName: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    {
      name: `graphql.resolve.${typeName}.${fieldName}`,
      op: 'graphql.resolve',
      kind: SpanKind.INTERNAL,
      attributes: {
        'graphql.type': typeName,
        'graphql.field': fieldName,
      },
    },
    fn
  )
}

/**
 * Create an email sending span
 */
export async function withEmailSpan<T>(
  template: string,
  recipient: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    {
      name: `email.send.${template}`,
      op: 'email.send',
      kind: SpanKind.CLIENT,
      attributes: {
        'email.template': template,
        'email.recipient_count': 1,
        // Don't include actual email address for privacy
      },
    },
    fn
  )
}

/**
 * Measure function execution time
 */
export function measureTime<T>(name: string, fn: () => T): { result: T; durationMs: number } {
  const start = performance.now()
  const result = fn()
  const durationMs = performance.now() - start

  addSpanEvent(`${name}.completed`, { durationMs })

  return { result, durationMs }
}

/**
 * Measure async function execution time
 */
export async function measureTimeAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await fn()
  const durationMs = performance.now() - start

  addSpanEvent(`${name}.completed`, { durationMs })

  return { result, durationMs }
}

// Re-export OpenTelemetry types for convenience
export { SpanKind, SpanStatusCode }
export type { Span, Tracer, Context }
