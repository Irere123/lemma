import { getEnv } from '@api/env-runtime'

export function isProduction() {
  const env = getEnv()
  return env.ENV === 'production'
}

export function getBaseUrl() {
  return getEnv().BASE_URL
}
