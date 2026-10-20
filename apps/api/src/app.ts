import { trpcServer } from '@hono/trpc-server'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import { createDb } from './db'
import { getCampaignById } from './db/queries/campaigns'
import { getUserDocumentById } from './db/queries/documents'
import { env, getRuntimeBindings } from './env-runtime'
import { createYogaServer } from './graphql'
import { createAuth } from './lib/auth'
import { API_VERSION, getBaseUrl } from './lib/constants'
import { createRouter } from './lib/utils'
import { withDatabase } from './rest/middleware/db'
import { routers } from './rest/routers'
import { createTRPCContext } from './trpc/init'
import { appRouter } from './trpc/routers/_app'

export function createApp() {
  const app = createRouter()
  const yoga = createYogaServer()

  // Local dev serves uploads from /assets (see below); the web app on another
  // port embeds them, so relax the same-origin CORP that secureHeaders sets.
  if (env.ENV === 'local') {
    app.use('/assets/*', async (c, next) => {
      await next()
      c.res.headers.set('cross-origin-resource-policy', 'cross-origin')
    })
  }

  app.use(secureHeaders())

  app.use(
    '*',
    cors({
      origin: env.ALLOWED_API_ORIGINS?.split(',') ?? [],
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowHeaders: [
        'Authorization',
        'Access-Control-Allow-Credentials',
        'Cookie',
        'Content-Type',
        'accept-language',
        'x-trpc-source',
        'x-user-locale',
        'x-user-timezone',
        'x-user-country',
        'X-Retry-After',
      ],
      exposeHeaders: ['Content-Length'],
      maxAge: 86400,
    })
  )

  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
      createContext: createTRPCContext,
    })
  )

  app.use('/graphql', withDatabase)
  app.on(['GET', 'POST'], '/graphql', async (c) => {
    return yoga.handle(c.req.raw, { honoContext: c })
  })

  // Liveness/health probe for uptime monitors and platform health checks.
  // Intentionally dependency-free so it stays green during partial outages.
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      version: API_VERSION,
      environment: env.ENV,
    })
  })

  app.doc('/openapi', {
    openapi: '3.1.0',
    info: {
      version: API_VERSION,
      title: 'Lemma Developer API',
      description: 'Lemma Developer API',
      contact: {
        name: 'Support',
        email: 'hello@irere.dev',
        url: 'https://irere.dev',
      },
      license: {
        name: 'AGPL-3.0 license',
        url: 'https://github.com/irere123/lemma/blob/main/LICENSE',
      },
    },
    servers: [
      {
        url: getBaseUrl(),
        description: 'Production API',
      },
    ],
    security: [{ token: [] }],
  })

  app.openAPIRegistry.registerComponent('securitySchemes', 'token', {
    type: 'http',
    scheme: 'bearer',
    description: 'Default authentication mechanism',
    'x-api-key-example': 'LEMMA.NOW API KEY',
  })

  app.get('/', Scalar({ url: '/openapi', pageTitle: 'Lemma API', theme: 'saturn' }))

  app.on(['POST', 'GET'], '/auth/*', (c) => {
    return createAuth().handler(c.req.raw)
  })

  // --- Realtime WebSocket channels (backed by Durable Objects) ---
  // Cookie-authenticated, then forwarded to the owning DO. Browsers can't set
  // WebSocket headers, so auth rides on the session cookie like the rest of the API.

  app.get('/realtime/campaigns/:campaignId', async (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return c.text('Expected websocket', 426)
    }

    const session = await createAuth().api.getSession({ headers: c.req.raw.headers })
    if (!session?.user) return c.text('Unauthorized', 401)

    const campaignId = c.req.param('campaignId')
    const { db } = createDb()
    const campaign = await getCampaignById(db, campaignId)
    if (!campaign || campaign.userId !== session.user.id) return c.text('Not found', 404)

    const namespace = getRuntimeBindings().CAMPAIGN_PROGRESS
    if (!namespace) return c.text('Realtime unavailable', 503)

    return namespace.getByName(campaignId).fetch(c.req.raw)
  })

  // Live editing: the editor syncs a document's title, subtitle and body with
  // its DocumentRoom over the Yjs protocol. Owner only.
  app.get('/realtime/documents/:documentId', async (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return c.text('Expected websocket', 426)
    }

    // Browsers attach cookies to cross-site WebSocket handshakes, so check
    // where the page opening this socket came from.
    const origin = c.req.header('origin')
    const allowed = env.ALLOWED_API_ORIGINS?.split(',') ?? []
    if (!origin || !allowed.includes(origin)) return c.text('Forbidden', 403)

    const session = await createAuth().api.getSession({ headers: c.req.raw.headers })
    if (!session?.user) return c.text('Unauthorized', 401)

    const documentId = c.req.param('documentId')
    const { db } = createDb()
    const document = await getUserDocumentById(db, documentId, session.user.id)
    if (!document) return c.text('Not found', 404)

    const namespace = getRuntimeBindings().DOCUMENT_ROOM
    if (!namespace) return c.text('Realtime unavailable', 503)

    const stub = namespace.getByName(documentId)
    await stub.ensure(documentId)
    return stub.fetch(c.req.raw)
  })

  // Local dev only: serve uploads from the simulated R2 bucket (production
  // serves them from the bucket's public domain).
  if (env.ENV === 'local') {
    app.get('/assets/*', async (c) => {
      const key = c.req.path.replace(/^\/assets\//, '')
      const object = await getRuntimeBindings().R2_BUCKET?.get?.(key)
      if (!object) return c.notFound()
      return new Response(object.body, {
        headers: {
          'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    })
  }

  app.get('/realtime/subscribers', async (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return c.text('Expected websocket', 426)
    }

    const session = await createAuth().api.getSession({ headers: c.req.raw.headers })
    if (!session?.user) return c.text('Unauthorized', 401)

    const namespace = getRuntimeBindings().WRITER_STATS
    if (!namespace) return c.text('Realtime unavailable', 503)

    const stub = namespace.getByName(session.user.id)
    await stub.ensure(session.user.id)
    return stub.fetch(c.req.raw)
  })

  app.route('/v1', routers)

  return app
}
