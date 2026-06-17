import { getEnv } from '@api/env-runtime'

/** Public API version, surfaced in the OpenAPI doc and the health endpoint. */
export const API_VERSION = '1.0.0'

export function isProduction() {
  const env = getEnv()
  return env.ENV === 'production'
}

export function getBaseUrl() {
  return getEnv().BASE_URL
}
