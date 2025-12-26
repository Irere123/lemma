import { env } from '@api/env-runtime'

export const BASE_URL =
  env.ENV === 'development' ? 'http://localhost:4000' : 'https://api.irere.dev'

export const isProduction = env.ENV === 'production'
