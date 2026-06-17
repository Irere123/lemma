import KSUID from 'ksuid'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppBindings } from '@api/lib/types'
import { onError, notFound } from '@api/lib/errors'

export const generateId = (prefix?: string) => {
  if (!prefix) {
    return KSUID.randomSync().string
  } else {
    return `${prefix}_${KSUID.randomSync().string}`
  }
}

export function createRouter() {
  const router = new OpenAPIHono<AppBindings>({
    // Consistent 400 envelope when request validation fails.
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              message: 'Validation failed',
              code: 'BAD_REQUEST',
              status: 400,
              details: result.error.issues,
            },
          },
          400
        )
      }
    },
  })

  router.onError(onError)
  router.notFound(notFound)

  return router
}
