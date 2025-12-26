import { getSessionCookie } from 'better-auth/cookies'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { apiKeyCache } from '@api/cache/api-keys-cache'
import { userCache } from '@api/cache/user-cache'
import { getApiKeyByToken, getUserById, updatedApiKeyLastUsedAt } from '@api/db/queries'
import { isValidApiKeyFormat } from '@api/db/utils/api-keys'
import { createAuth } from '@api/lib/auth'
import { hash } from '@api/lib/encryption'
import { logger } from '@api/lib/observability'
import { withSpan } from '@api/lib/observability/tracing'
import { expandScopes } from '@lemma/common/scopes'

const middlewareLogger = logger.child({ component: 'rest', subcomponent: 'auth-middleware' })

export const withAuth: MiddlewareHandler = async (c, next) => {
  return withSpan({ name: 'auth.middleware', op: 'auth' }, async (span) => {
    const timer = middlewareLogger.time('auth-middleware')
    const sessionCookie = getSessionCookie(c.req.raw.headers, {
      cookiePrefix: 'lemma',
    })
    const authHeader = c.req.header('Authorization')

    try {
      if (sessionCookie) {
        span.setAttribute('auth.method', 'session-cookie')
        const auth = createAuth()

        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        })

        if (!session || !session.user) {
          middlewareLogger.warn('Authentication failed: invalid session', {
            hasCookie: !!sessionCookie,
          })
          throw new HTTPException(401, {
            message: 'Not authenticated',
          })
        }

        span.setAttribute('auth.userId', session.user.id)
        c.set('session', session)
        c.set('scopes', expandScopes(['apis.all']))

        middlewareLogger.debug('Session authentication successful', { userId: session.user.id })
        await next()
        return
      }

      if (!authHeader) {
        middlewareLogger.warn('Authentication failed: no authorization header')
        throw new HTTPException(401, { message: 'Authorization header required' })
      }

      const [scheme, token] = authHeader.split(' ')

      if (scheme !== 'Bearer') {
        middlewareLogger.warn('Authentication failed: invalid scheme', { scheme })
        throw new HTTPException(401, { message: 'Invalid authorization scheme' })
      }

      if (!token) {
        middlewareLogger.warn('Authentication failed: no token')
        throw new HTTPException(401, { message: 'Token required' })
      }

      // Handle API keys (start with lemma_ but not lemma_access_token_)
      if (!token.startsWith('lemma_') || !isValidApiKeyFormat(token)) {
        middlewareLogger.warn('Authentication failed: invalid token format')
        throw new HTTPException(401, { message: 'Invalid token format' })
      }

      span.setAttribute('auth.method', 'api-key')
      const db = c.get('db')
      const keyHash = hash(token)

      // Check cache first for API key
      let apiKey = await apiKeyCache.get(keyHash)

      if (!apiKey) {
        // If not cache, query database
        apiKey = await getApiKeyByToken(db, keyHash)
        if (apiKey) {
          // Store in cache for future requests
          await apiKeyCache.set(keyHash, apiKey)
        }
      }

      if (!apiKey) {
        middlewareLogger.warn('Authentication failed: invalid API key')
        throw new HTTPException(401, { message: 'Invalid API key' })
      }

      // Check cache first for user
      let user = await userCache.get(apiKey.userId)

      if (!user) {
        // If not cache, query database
        user = await getUserById(db, apiKey.userId)
        if (user) {
          // Store in cache for future requests
          await userCache.set(apiKey.userId, user)
        }
      }

      if (!user) {
        middlewareLogger.warn('Authentication failed: user not found', { userId: apiKey.userId })
        throw new HTTPException(401, { message: 'User not found' })
      }

      span.setAttribute('auth.userId', user.id)
      const session = {
        user: {
          id: user.id,
          email: user.email,
          image: user.image,
        },
      }

      c.set('session', session)
      c.set('scopes', expandScopes(apiKey.scopes ?? []))

      // Update last used at
      updatedApiKeyLastUsedAt(db, apiKey.id)

      middlewareLogger.debug('API key authentication successful', { userId: user.id })
      await next()
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      middlewareLogger.error('Auth middleware error', error as Error)
      throw error
    } finally {
      timer()
    }
  })
}
