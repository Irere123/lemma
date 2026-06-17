import { expandScopes } from '@lemma/common/scopes'
import { getSessionCookie } from 'better-auth/cookies'
import { GraphQLError } from 'graphql'
import type { Context } from 'hono'

import { apiKeyCache } from '@api/cache/api-keys-cache'
import { userCache } from '@api/cache/user-cache'
import type { DB } from '@api/db'
import {
  getApiKeyByToken,
  getUserById,
  updatedApiKeyLastUsedAt,
  validateAccessToken,
} from '@api/db/queries'
import { isOAuthAccessToken, isValidApiKeyFormat } from '@api/db/utils/api-keys'
import { createAuth } from '@api/lib/auth'
import { hash } from '@api/lib/encryption'
import { logger } from '@api/lib/observability'
import type { Session } from '@api/lib/types'
import { createLoaders, type GraphQLLoaders } from './dataloaders'

const graphqlLogger = logger.child({ component: 'graphql', subcomponent: 'context' })

export type GraphQLContext = {
  db: DB
  session: Session | null
  scopes: string[]
  isAuthenticated: boolean
  loaders: GraphQLLoaders
}

export async function createGraphQLContext(honoContext: Context): Promise<GraphQLContext> {
  const timer = graphqlLogger.time('create-graphql-context')
  const db = honoContext.get('db') as DB
  const request = honoContext.req.raw

  let session: Session | null = null
  let scopes: string[] = []

  try {
    // Try session cookie authentication
    const sessionCookie = getSessionCookie(request.headers, {
      cookiePrefix: 'lemma',
    })

    if (sessionCookie) {
      const auth = createAuth()
      const authSession = await auth.api.getSession({
        headers: request.headers,
      })

      if (authSession?.user) {
        session = authSession
        scopes = expandScopes(['apis.all'])
        graphqlLogger.debug('GraphQL context: session authentication', {
          userId: session.user.id,
        })
      }
    }

    // Try Bearer token authentication
    if (!session) {
      const authHeader = request.headers.get('Authorization')

      if (authHeader) {
        const [scheme, token] = authHeader.split(' ')

        // OAuth access tokens (lemm_access_token_*). Not cached so revocation and
        // expiry are always enforced on the live record.
        if (scheme === 'Bearer' && token && isOAuthAccessToken(token)) {
          const oauthToken = await validateAccessToken(db, token)

          if (oauthToken?.user) {
            session = {
              user: {
                id: oauthToken.user.id,
                email: oauthToken.user.email,
                name: oauthToken.user.name,
                image: oauthToken.user.image,
                emailVerified: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              session: {} as any,
            }
            scopes = expandScopes(oauthToken.scopes ?? [])

            graphqlLogger.debug('GraphQL context: OAuth access token authentication', {
              userId: oauthToken.user.id,
              scopeCount: scopes.length,
            })
          }
        } else if (scheme === 'Bearer' && token && isValidApiKeyFormat(token)) {
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

              graphqlLogger.debug('GraphQL context: API key authentication', {
                userId: user.id,
                scopeCount: scopes.length,
              })
            }
          }
        }
      }
    }

    const context = {
      db,
      session,
      scopes,
      isAuthenticated: session !== null,
      loaders: createLoaders(db),
    }

    return context
  } catch (error) {
    graphqlLogger.error('Error creating GraphQL context', error as Error)
    throw error
  } finally {
    timer()
  }
}

export function requireAuth(
  context: GraphQLContext
): asserts context is GraphQLContext & { session: Session } {
  if (!context.isAuthenticated || !context.session) {
    graphqlLogger.warn('GraphQL authentication required but not provided')
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    })
  }
}

export function requireScope(context: GraphQLContext, scope: string): void {
  requireAuth(context)

  if (!context.scopes.includes(scope)) {
    graphqlLogger.warn('GraphQL scope check failed', {
      userId: context.session?.user.id,
      requiredScope: scope,
      userScopes: context.scopes,
    })
    throw new GraphQLError(`Missing required scope: ${scope}`, {
      extensions: { code: 'FORBIDDEN' },
    })
  }
}
