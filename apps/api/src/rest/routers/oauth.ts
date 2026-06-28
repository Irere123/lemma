import type { DB } from '@api/db'
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  getOAuthApplicationByClientId,
  hasUserEverAuthorizedApp,
  refreshAccessToken,
  revokeAccessToken,
} from '@api/db/queries'
import { sendEmail } from '@api/lib/messaging/email/mailer'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { protectedMiddleware, publicMiddleware } from '@api/rest/middleware'
import {
  oauthApplicationInfoSchema,
  oauthAuthorizationDecisionSchema,
  oauthAuthorizationRequestSchema,
  oauthErrorResponseSchema,
  oauthRefreshTokenRequestSchema,
  oauthRevokeTokenRequestSchema,
  oauthTokenRequestSchema,
  oauthTokenResponseSchema,
} from '@api/schemas/oauth-flow'
import { validateClientCredentials } from '@api/utils/oauth'
import { createRoute } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

const app = createRouter()

app.use('*', ...publicMiddleware)

app.openapi(
  createRoute({
    method: 'get',
    path: '/authorize',
    summary: 'OAuth Authorization Endpoint',
    operationId: 'getOAuthAuthorization',
    description: 'Initiate OAuth authorization flow and get consent screen information',
    tags: ['OAuth'],
    request: {
      query: oauthAuthorizationRequestSchema,
    },
    responses: {
      200: {
        description: 'Application information for consent screen',
        content: {
          'application/json': {
            schema: oauthApplicationInfoSchema,
          },
        },
      },
      400: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: oauthErrorResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get('db') as DB
    const query = c.req.valid('query')
    const { client_id, redirect_uri, scope, state, code_challenge } = query

    const application = await getOAuthApplicationByClientId(db, client_id)
    if (!application || !application.active) {
      throw new HTTPException(400, {
        message: 'Invalid client_id',
      })
    }

    // Enforce PKCE for public clients
    if (application.isPublic && !code_challenge) {
      throw new HTTPException(400, {
        message: 'PKCE is required for public clients',
      })
    }

    if (!application.redirectUris.includes(redirect_uri)) {
      throw new HTTPException(400, {
        message: 'Invalid redirect_uri',
      })
    }

    const requestedScopes = scope.split(' ').filter(Boolean)
    const invalidScopes = requestedScopes.filter((s) => !application.scopes.includes(s))

    if (invalidScopes.length > 0) {
      throw new HTTPException(400, {
        message: `Invalid scopes: ${invalidScopes.join(', ')}`,
      })
    }

    const applicationInfo = {
      id: application.id,
      name: application.name,
      description: application.description,
      overview: application.overview,
      logoUrl: application.logoUrl,
      website: application.website,
      installUrl: application.installUrl,
      screenshots: application.screenshots,
      clientId: application.clientId,
      scopes: requestedScopes,
      redirectUri: redirect_uri,
      state,
      status: application.status,
    }

    return c.json(validateResponse(applicationInfo, oauthApplicationInfoSchema), 200)
  }
)

app.openapi(
  createRoute({
    method: 'post',
    path: '/authorize',
    summary: 'OAuth Authorization Decision',
    operationId: 'postOAuthAuthorization',
    description: "Process user's authorization decision (allow/deny)",
    tags: ['OAuth'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: oauthAuthorizationDecisionSchema,
          },
        },
      },
    },
    middleware: [...protectedMiddleware],
    responses: {
      200: {
        description: 'Authorization decision processed, returns redirect URL',
        content: {
          'application/json': {
            schema: z.object({
              redirect_url: z.string().url(),
            }),
          },
        },
      },
      400: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: z.object({
              redirect_url: z.string().url(),
            }),
          },
        },
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({
              redirect_url: z.string().url(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get('db') as DB
    const session = c.get('session') as { user: { id: string; email?: string } } | undefined

    if (!session || !session.user) {
      throw new HTTPException(401, {
        message: 'User must be authenticated',
      })
    }

    const body = c.req.valid('json')
    const { client_id, decision, scopes, redirect_uri, state, code_challenge } = body

    const application = await getOAuthApplicationByClientId(db, client_id)
    if (!application || !application.active) {
      throw new HTTPException(400, {
        message: 'Invalid client_id',
      })
    }

    // Enforce PKCE for public clients
    if (application.isPublic && !code_challenge) {
      throw new HTTPException(400, {
        message: 'PKCE is required for public clients',
      })
    }

    const redirectUrl = new URL(redirect_uri)

    if (decision === 'deny') {
      redirectUrl.searchParams.set('error', 'access_denied')
      redirectUrl.searchParams.set('error_description', 'User denied access')
      if (state) {
        redirectUrl.searchParams.set('state', state)
      }
      return c.json({ redirect_url: redirectUrl.toString() })
    }

    const authCode = await createAuthorizationCode(db, {
      applicationId: application.id,
      userId: session.user.id,
      scopes,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
    })

    if (!authCode) {
      throw new HTTPException(500, {
        message: 'Failed to create authorization code',
      })
    }

    // Send app installation email only if this is the first time authorizing this app
    try {
      // Check if user has ever authorized this application (including expired tokens)
      const hasAuthorizedBefore = await hasUserEverAuthorizedApp(
        db,
        session.user.id,
        application.id
      )

      if (!hasAuthorizedBefore && session.user.email) {
        await sendEmail({
          to: session.user.email,
          subject: `An app has been added to your account`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>New App Authorized</h2>
              <p>You have successfully authorized <strong>${application.name}</strong> to access your account.</p>
              ${application.description ? `<p>${application.description}</p>` : ''}
              <p>If you did not authorize this application, please revoke access immediately.</p>
            </div>
          `,
          emailType: 'transactional',
        })
      }
    } catch (error) {
      // Log error but don't fail the OAuth flow
      console.error('Failed to send app installation email:', error)
    }

    redirectUrl.searchParams.set('code', authCode.code)
    if (state) {
      redirectUrl.searchParams.set('state', state)
    }

    return c.json({ redirect_url: redirectUrl.toString() })
  }
)

app.openapi(
  createRoute({
    method: 'post',
    path: '/token',
    summary: 'OAuth Token Exchange',
    operationId: 'postOAuthToken',
    description: 'Exchange authorization code for access token or refresh an access token',
    tags: ['OAuth'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.union([oauthTokenRequestSchema, oauthRefreshTokenRequestSchema]),
          },
          'application/x-www-form-urlencoded': {
            schema: z.union([oauthTokenRequestSchema, oauthRefreshTokenRequestSchema]),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Token exchange successful',
        content: {
          'application/json': {
            schema: oauthTokenResponseSchema,
          },
        },
      },
      400: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: oauthErrorResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get('db') as DB
    const contentType = c.req.header('content-type') || ''

    let body: any
    if (contentType.includes('application/x-www-form-urlencoded')) {
      body = await c.req.parseBody()
    } else {
      body = c.req.valid('json')
    }

    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      client_secret,
      code_verifier,
      refresh_token,
      scope,
    } = body

    const application = await getOAuthApplicationByClientId(db, client_id)
    if (!application || !application.active) {
      throw new HTTPException(400, {
        message: 'Invalid client credentials',
      })
    }

    // For public clients, client_secret should not be provided
    if (application.isPublic) {
      if (client_secret) {
        throw new HTTPException(400, {
          message: 'Public clients must not send client_secret',
        })
      }
    } else {
      // For confidential clients, validate client_secret
      if (!validateClientCredentials(application, client_secret)) {
        throw new HTTPException(400, {
          message: 'Invalid client credentials',
        })
      }
    }

    if (grant_type === 'authorization_code') {
      if (!code || !redirect_uri) {
        throw new HTTPException(400, {
          message: 'Missing required parameters: code and redirect_uri are required',
        })
      }

      try {
        const tokenResponse = await exchangeAuthorizationCode(
          db,
          code,
          redirect_uri,
          application.id,
          code_verifier
        )

        const response = {
          access_token: tokenResponse.accessToken,
          token_type: tokenResponse.tokenType,
          expires_in: tokenResponse.expiresIn,
          refresh_token: tokenResponse.refreshToken || '',
          scope: tokenResponse.scopes.join(' '),
        }

        return c.json(validateResponse(response, oauthTokenResponseSchema), 200)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Handle specific OAuth errors with proper error codes
        if (errorMessage.includes('Authorization code expired')) {
          throw new HTTPException(400, {
            message: 'The authorization code has expired. Please restart the OAuth flow.',
          })
        }

        if (errorMessage.includes('Authorization code already used')) {
          throw new HTTPException(400, {
            message:
              'The authorization code has already been used. All related tokens have been revoked for security.',
          })
        }

        if (errorMessage.includes('Invalid authorization code')) {
          throw new HTTPException(400, {
            message: 'The authorization code is invalid or malformed.',
          })
        }

        if (errorMessage.includes('redirect_uri')) {
          throw new HTTPException(400, {
            message: 'The redirect_uri does not match the one used in the authorization request.',
          })
        }

        // Generic fallback for other errors
        throw new HTTPException(400, {
          message: 'Failed to exchange authorization code for access token.',
        })
      }
    }

    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        throw new HTTPException(400, {
          message: 'Missing refresh_token',
        })
      }

      try {
        const requestedScopes = scope ? scope.split(' ').filter(Boolean) : undefined

        const tokenResponse = await refreshAccessToken(db, {
          refreshToken: refresh_token,
          applicationId: application.id,
          scopes: requestedScopes,
        })

        const response = {
          access_token: tokenResponse.accessToken,
          token_type: tokenResponse.tokenType,
          expires_in: tokenResponse.expiresIn,
          refresh_token: tokenResponse.refreshToken || '',
          scope: tokenResponse.scopes.join(' '),
        }

        return c.json(validateResponse(response, oauthTokenResponseSchema), 200)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        if (errorMessage.includes('Invalid refresh token')) {
          throw new HTTPException(400, {
            message: 'Invalid refresh token',
          })
        }

        if (errorMessage.includes('expired')) {
          throw new HTTPException(400, {
            message: 'Refresh token expired',
          })
        }

        if (errorMessage.includes('revoked')) {
          throw new HTTPException(400, {
            message: 'Refresh token revoked',
          })
        }

        throw new HTTPException(400, {
          message: 'Failed to refresh access token',
        })
      }
    }

    throw new HTTPException(400, {
      message: 'Grant type not supported',
    })
  }
)

app.openapi(
  createRoute({
    method: 'post',
    path: '/revoke',
    summary: 'OAuth Token Revocation',
    operationId: 'postOAuthRevoke',
    description: 'Revoke an access token or refresh token',
    tags: ['OAuth'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: oauthRevokeTokenRequestSchema,
          },
          'application/x-www-form-urlencoded': {
            schema: oauthRevokeTokenRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Token revocation successful',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get('db') as DB
    const contentType = c.req.header('content-type') || ''

    let body: any
    if (contentType.includes('application/x-www-form-urlencoded')) {
      body = await c.req.parseBody()
    } else {
      body = c.req.valid('json')
    }

    const { token, client_id, client_secret } = body

    const application = await getOAuthApplicationByClientId(db, client_id)
    if (!application || !application.active) {
      throw new HTTPException(400, {
        message: 'Invalid client credentials',
      })
    }

    // For public clients, client_secret should not be provided
    if (application.isPublic) {
      if (client_secret) {
        throw new HTTPException(400, {
          message: 'Public clients must not send client_secret',
        })
      }
    } else {
      // For confidential clients, validate client_secret
      if (!validateClientCredentials(application, client_secret)) {
        throw new HTTPException(400, {
          message: 'Invalid client credentials',
        })
      }
    }

    await revokeAccessToken(db, {
      token,
      applicationId: application.id,
    })

    return c.json({ success: true })
  }
)

export { app as oauthRouter }
