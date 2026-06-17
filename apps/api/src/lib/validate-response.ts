import { HTTPException } from 'hono/http-exception'
import { z } from 'zod/v4'
import type { core } from 'zod/v4'

import { logger } from '@api/lib/observability'

type SchemaType<T> = z.ZodObject<core.$ZodShape, core.$strip> & {
  _zod: { output: T }
}

const responseLogger = logger.child({ component: 'rest', subcomponent: 'validate-response' })

/**
 * Validates an outgoing response against its schema. A mismatch is a server-side
 * bug, so we throw a masked 500 (handled by the global error handler) rather
 * than returning HTTP 200 with the internal Zod field tree to the client.
 */
export const validateResponse = (data: any, schema: SchemaType<any>) => {
  const result = schema.safeParse(data)

  if (!result.success) {
    // Logged server-side only — never returned to the client.
    responseLogger.error('Response validation failed', result.error as Error, {
      details: z.treeifyError(result.error),
    })

    throw new HTTPException(500, { message: 'Response validation failed' })
  }

  return result.data
}
