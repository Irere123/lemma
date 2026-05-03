import { trpcServer } from '@hono/trpc-server'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import { env } from './env-runtime'
import { createYogaServer } from './graphql'
import { createAuth } from './lib/auth'
import { getBaseUrl } from './lib/constants'
import { createRouter } from './lib/utils'
import { withDatabase } from './rest/middleware/db'
import { routers } from './rest/routers'
import { createTRPCContext } from './trpc/init'
import { appRouter } from './trpc/routers/_app'

export function createApp() {
  const app = createRouter()
  const yoga = createYogaServer()

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

  app.doc('/openapi', {
    openapi: '3.1.0',
    info: {
      version: '0.0.1',
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
    description: 'Default authenticaton mechanism',
    'x-api-key-example': 'LEMMA.NOW API KEY',
  })

  app.get('/', Scalar({ url: '/openapi', pageTitle: 'Lemma API', theme: 'saturn' }))

  app.on(['POST', 'GET'], '/auth/*', (c) => {
    return createAuth().handler(c.req.raw)
  })

  app.route('/v1', routers)

  return app
}
