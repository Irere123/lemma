import { parseEnv } from '@api/env'

export const env = parseEnv(Object.assign(process.env))
