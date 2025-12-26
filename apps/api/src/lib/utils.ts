import KSUID from 'ksuid'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppBindings } from '@api/lib/types'

export const generateId = (prefix?: string) => {
  if (!prefix) {
    return KSUID.randomSync().string
  } else {
    return `${prefix}_${KSUID.randomSync().string}`
  }
}

export function createRouter() {
  return new OpenAPIHono<AppBindings>()
}
