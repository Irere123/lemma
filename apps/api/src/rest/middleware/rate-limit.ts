import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

import type { RateLimitBinding } from '@api/env-runtime'
import { hash } from '@api/lib/encryption'
import { logger } from '@api/lib/observability'

const rateLimitLogger = logger.child({ component: 'rest', subcomponent: 'rate-limit-middleware' })

type RateLimiterName = 'AUTH_RATE_LIMITER' | 'API_RATE_LIMITER'

/**
 * Derive a stable rate-limit key for the caller. Prefers the bearer token
 * (hashed — never the raw token), then the authenticated session user, then the
 * client IP. The IP fallback is what protects unauthenticated endpoints.
 */
function resolveClientKey(c: Context): string {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) return `t:${hash(token)}`
  }

  const session = c.get('session') as { user?: { id?: string } } | undefined
  if (session?.user?.id) return `u:${session.user.id}`

  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  return `ip:${ip}`
}

/**
 * Rate-limit middleware backed by the Cloudflare Workers Rate Limiting binding.
 * If the binding is not configured (e.g. local dev), it fails open so local
 * development is unaffected. Limiter errors also fail open to avoid taking the
 * API down because of the limiter.
 *
 * @param name  Which configured limiter binding to use.
 * @param scope Key namespace so different routes don't share token buckets.
 */
export function withRateLimit(name: RateLimiterName, scope: string): MiddlewareHandler {
  return async (c, next) => {
    const limiter = c.env?.[name] as RateLimitBinding | undefined

    if (!limiter) {
      await next()
      return
    }

    const key = `${scope}:${resolveClientKey(c)}`

    try {
      const { success } = await limiter.limit({ key })
      if (!success) {
        rateLimitLogger.warn('Rate limit exceeded', { scope })
        throw new HTTPException(429, {
          message: 'Too many requests. Please slow down and try again later.',
          res: new Response(
            JSON.stringify({ error: 'Too many requests. Please slow down and try again later.' }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
          ),
        })
      }
    } catch (error) {
      if (error instanceof HTTPException) throw error
      rateLimitLogger.error('Rate limiter error', error as Error, { scope })
    }

    await next()
  }
}

/** Strict limiter for auth/OAuth endpoints (brute-force & abuse protection). */
export const authRateLimit = (): MiddlewareHandler => withRateLimit('AUTH_RATE_LIMITER', 'auth')

/** General limiter for the public API surface (REST + GraphQL). */
export const apiRateLimit = (): MiddlewareHandler => withRateLimit('API_RATE_LIMITER', 'api')
