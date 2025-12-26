import { expandScopes } from '@lemma/common/scopes'
import { getSessionCookie } from 'better-auth/cookies'
import { GraphQLError } from 'graphql'
import type { Context } from 'hono'

import { apiKeyCache } from '@api/cache/api-keys-cache'
import { userCache } from '@api/cache/user-cache'
import type { DB } from '@api/db'
import { getApiKeyByToken, getUserById, updatedApiKeyLastUsedAt } from '@api/db/queries'
import { isValidApiKeyFormat } from '@api/db/utils/api-keys'
import { createAuth } from '@api/lib/auth'
import { hash } from '@api/lib/encryption'
import type { Session } from '@api/lib/types'

export type GraphQLContext = {
  db: DB
  session: Session | null
  scopes: string[]
  isAuthenticated: boolean
}

export async function createGraphQLContext(honoContext: Context): Promise<GraphQLContext> {
  const db = honoContext.get('db') as DB
  const request = honoContext.req.raw

  let session: Session | null = null
  let scopes: string[] = []

  // Try session cookie authentication
  const sessionCookie = getSessionCookie(request.headers, {
    cookiePrefix: 'lemma',
  })

  if (sessionCookie) {
    const auth = createAuth()
    const authSession = await auth.api.getSession({
      headers: request.headers,
    })

    if (authSession && authSession.user) {
      session = authSession
      scopes = expandScopes(['apis.all'])
    }
  }

  // Try Bearer token authentication
  if (!session) {
    const authHeader = request.headers.get('Authorization')

    if (authHeader) {
      const [scheme, token] = authHeader.split(' ')

      if (scheme === 'Bearer' && token && isValidApiKeyFormat(token)) {
        const keyHash = hash(token)

        // Check cache first for API key
        let apiKey = await apiKeyCache.get(keyHash)

        if (!apiKey) {
          apiKey = await getApiKeyByToken(db, keyHash)
          if (apiKey) {
            await apiKeyCache.set(keyHash, apiKey)
          }
        }

        if (apiKey) {
          // Check cache first for user
          let user = await userCache.get(apiKey.userId)

          if (!user) {
            user = await getUserById(db, apiKey.userId)
            if (user) {
              await userCache.set(apiKey.userId, user)
            }
          }

          if (user) {
            session = {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              },
              session: {} as any,
            }
            scopes = expandScopes(apiKey.scopes ?? [])

            // Update last used at (fire and forget)
            updatedApiKeyLastUsedAt(db, apiKey.id)
          }
        }
      }
    }
  }

  return {
    db,
    session,
    scopes,
    isAuthenticated: session !== null,
  }
}

export function requireAuth(
  context: GraphQLContext
): asserts context is GraphQLContext & { session: Session } {
  if (!context.isAuthenticated || !context.session) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    })
  }
}

export function requireScope(context: GraphQLContext, scope: string): void {
  requireAuth(context)

  if (!context.scopes.includes(scope)) {
    throw new GraphQLError(`Missing required scope: ${scope}`, {
      extensions: { code: 'FORBIDDEN' },
    })
  }
}
