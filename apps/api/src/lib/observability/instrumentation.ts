import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base'
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

import { env } from '@api/env-runtime'
import { isProduction } from '@api/lib/constants'

/**
 * OpenTelemetry Configuration
 */
export interface OtelConfig {
  serviceName: string
  serviceVersion: string
  environment: string
  otlpEndpoint?: string
  enableConsoleExporter?: boolean
}

const defaultConfig: OtelConfig = {
  serviceName: 'lemma-api',
  serviceVersion: '1.0.0',
  environment: env.ENV,
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  enableConsoleExporter: !isProduction,
}

let sdk: NodeSDK | null = null

/**
 * Initialize OpenTelemetry SDK
 * This should be called at the very beginning of your application
 */
export function initializeOpenTelemetry(config: Partial<OtelConfig> = {}): NodeSDK {
  const mergedConfig = { ...defaultConfig, ...config }

  // Create resource with service information
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: mergedConfig.serviceName,
    [ATTR_SERVICE_VERSION]: mergedConfig.serviceVersion,
  })

  // Configure span processors
  const spanProcessors: SpanProcessor[] = []

  // Add OTLP exporter if endpoint is configured
  if (mergedConfig.otlpEndpoint) {
    const otlpExporter = new OTLPTraceExporter({
      url: `${mergedConfig.otlpEndpoint}/v1/traces`,
    })
    spanProcessors.push(new BatchSpanProcessor(otlpExporter))
  }

  // Add console exporter for development
  if (mergedConfig.enableConsoleExporter && !isProduction) {
    spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()))
  }

  // Create and configure SDK
  sdk = new NodeSDK({
    resource,
    spanProcessors,
    instrumentations: [
      new HttpInstrumentation({
        // Ignore health check endpoints
        ignoreIncomingRequestHook: (request) => {
          const url = request.url || ''
          return url.includes('/health') || url.includes('/ready')
        },
        // Add custom attributes to spans
        requestHook: (span, request) => {
          if (request && 'headers' in request && request.headers) {
            const headers = request.headers as Record<string, string | string[] | undefined>
            span.setAttribute('http.request.id', (headers['x-request-id'] as string) || 'unknown')
          }
        },
        responseHook: (span, response) => {
          if (response && 'headers' in response && response.headers) {
            const headers = response.headers as Record<string, string | string[] | undefined>
            span.setAttribute('http.response.size', (headers['content-length'] as string) || '0')
          }
        },
      }),
    ],
  })

  // Start the SDK
  sdk.start()

  // Graceful shutdown
  const shutdown = async () => {
    try {
      await sdk?.shutdown()
      console.log('[OpenTelemetry] SDK shut down successfully')
    } catch (error) {
      console.error('[OpenTelemetry] Error shutting down SDK:', error)
    }
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  console.log(
    `[OpenTelemetry] Initialized for ${mergedConfig.serviceName} (${mergedConfig.environment})`
  )

  return sdk
}

/**
 * Get the current SDK instance
 */
export function getOpenTelemetrySDK(): NodeSDK | null {
  return sdk
}

/**
 * Shutdown the OpenTelemetry SDK
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown()
    sdk = null
  }
}
