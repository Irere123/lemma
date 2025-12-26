import { costLimitPlugin } from '@escape.tech/graphql-armor-cost-limit'
import { maxDepthPlugin } from '@escape.tech/graphql-armor-max-depth'
import { maxTokensPlugin } from '@escape.tech/graphql-armor-max-tokens'
import { useDisableIntrospection } from '@graphql-yoga/plugin-disable-introspection'

import { isProduction } from '@api/lib/constants'

/**
 * Query Depth Limiting
 * Prevents deeply nested queries that could cause performance issues
 * Example of a query that would be blocked (depth > 7):
 * query { user { posts { comments { author { posts { comments { ... } } } } } } }
 */
const depthLimit = maxDepthPlugin({
  n: 7, // Maximum query depth
  ignoreIntrospection: true,
})

/**
 * Max Tokens Plugin
 * Limits the number of tokens in a query to prevent DoS attacks
 * via extremely long queries
 */
const tokenLimit = maxTokensPlugin({
  n: 1000, // Maximum number of tokens
})

/**
 * Cost Limit Plugin
 * Analyzes query complexity and blocks expensive queries
 * Each field has a cost, and the total cost must not exceed the limit
 */
const costLimit = costLimitPlugin({
  maxCost: 5000, // Maximum query cost
  objectCost: 2, // Cost per object type
  scalarCost: 1, // Cost per scalar field
  depthCostFactor: 1.5, // Multiplier based on depth
  ignoreIntrospection: true,
})

/**
 * Disable Introspection in Production
 * Prevents attackers from discovering the schema structure
 */
const disableIntrospection = useDisableIntrospection()

/**
 * Error Masking Plugin
 * Hides internal error details in production
 */
function createErrorMaskingPlugin() {
  return {
    onExecute() {
      return {
        onExecuteDone({ result, setResult }: { result: any; setResult: (r: any) => void }) {
          if (!isProduction) return

          if ('errors' in result && result.errors) {
            const maskedErrors = result.errors.map((error: any) => {
              // Preserve specific error codes we want to expose
              const code = error.extensions?.code as string | undefined
              const exposedCodes = [
                'UNAUTHENTICATED',
                'FORBIDDEN',
                'NOT_FOUND',
                'BAD_REQUEST',
                'VALIDATION_ERROR',
              ]

              if (code && exposedCodes.includes(code)) {
                return error
              }

              // Mask internal errors
              return {
                message: 'An unexpected error occurred',
                extensions: { code: 'INTERNAL_SERVER_ERROR' },
              }
            })

            setResult({
              ...result,
              errors: maskedErrors,
            })
          }
        },
      }
    },
  }
}

/**
 * Query Logging Plugin (for debugging and monitoring)
 */
function createQueryLoggingPlugin() {
  return {
    onExecute({ args }: { args: any }) {
      const start = Date.now()
      const operationName = args.operationName || 'anonymous'

      return {
        onExecuteDone({ result }: { result: any }) {
          const duration = Date.now() - start

          // Log slow queries (> 1 second)
          if (duration > 1000) {
            console.warn(`[GraphQL] Slow query detected: ${operationName} took ${duration}ms`)
          }

          // Log errors
          if ('errors' in result && result.errors?.length) {
            console.error(`[GraphQL] Query ${operationName} failed:`, result.errors)
          }
        },
      }
    },
  }
}

/**
 * Get all security plugins based on environment
 */
export function getSecurityPlugins() {
  const plugins: any[] = [
    // Always enabled - GraphQL Armor plugins
    depthLimit,
    tokenLimit,
    costLimit,
    // Custom plugins
    createQueryLoggingPlugin(),
  ]

  // Production-only plugins
  if (isProduction) {
    plugins.push(disableIntrospection)
    plugins.push(createErrorMaskingPlugin())
  }

  return plugins
}
