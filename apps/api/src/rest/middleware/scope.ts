import type { Scope } from '@lemma/common/scopes'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { logger } from '@api/lib/observability'
import { withSpan } from '@api/lib/observability/tracing'

const middlewareLogger = logger.child({ component: 'rest', subcomponent: 'scope-middleware' })

export const withRequiredScope = (...requiredScopes: Scope[]): MiddlewareHandler => {
  return async (c, next) => {
    return withSpan(
      {
        name: 'scope.check',
        op: 'auth',
        attributes: { 'scope.required': requiredScopes.join(',') },
      },
      async (span) => {
        const scopes = c.get('scopes') as Scope[] | undefined
        const session = c.get('session') as { user: { id: string } } | undefined

        if (!scopes) {
          middlewareLogger.warn('Scope check failed: no scopes found', {
            userId: session?.user.id,
            requiredScopes,
          })
          throw new HTTPException(401, {
            message: 'No scopes found for the current user. Authentication is required.',
          })
        }

        // Check if user has at least one of the required scopes
        const hasRequiredScope = requiredScopes.some((requiredScope) =>
          scopes.includes(requiredScope)
        )

        if (!hasRequiredScope) {
          span.setAttribute('scope.check.result', 'denied')
          middlewareLogger.warn('Scope check failed: insufficient permissions', {
            userId: session?.user.id,
            requiredScopes,
            userScopes: scopes,
          })
          throw new HTTPException(403, {
            message: `Insufficient permissions. Required scopes: ${requiredScopes.join(',')}. Your scopes: ${scopes.join(', ')}`,
          })
        }

        span.setAttribute('scope.check.result', 'allowed')
        span.setAttribute('scope.userScopes', scopes.join(','))
        middlewareLogger.debug('Scope check passed', { requiredScopes, userScopes: scopes })
        await next()
      }
    )
  }
}
