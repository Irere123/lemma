import { z } from '@hono/zod-openapi'

/**
 * Canonical error envelope returned by every REST endpoint, matching the shape
 * produced by the global error handler (see `src/lib/errors.ts`).
 */
export const errorResponseSchema = z
  .object({
    error: z.object({
      message: z.string().openapi({ example: 'Not found' }),
      code: z.string().openapi({ example: 'NOT_FOUND' }),
      status: z.number().openapi({ example: 404 }),
      details: z.unknown().optional(),
    }),
  })
  .openapi('ErrorResponse')

const DEFAULT_DESCRIPTIONS: Record<number, string> = {
  400: 'Bad request — validation failed',
  401: 'Unauthorized — authentication required or invalid',
  403: 'Forbidden — missing required scope',
  404: 'Not found',
  409: 'Conflict',
  413: 'Payload too large',
  415: 'Unsupported media type',
  429: 'Too many requests — rate limit exceeded',
  500: 'Internal server error',
}

/**
 * Build an OpenAPI `responses` fragment for the given error status codes, all
 * using the shared error envelope. Spread into a route's `responses` object:
 *
 * ```ts
 * responses: { 200: {...}, ...errorResponses(401, 403, 404) }
 * ```
 */
export function errorResponses(...statuses: number[]) {
  const responses: Record<
    number,
    { description: string; content: { 'application/json': { schema: typeof errorResponseSchema } } }
  > = {}

  for (const status of statuses) {
    responses[status] = {
      description: DEFAULT_DESCRIPTIONS[status] ?? 'Error',
      content: { 'application/json': { schema: errorResponseSchema } },
    }
  }

  return responses
}
