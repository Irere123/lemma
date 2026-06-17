import { randomBytes } from 'node:crypto'

/**
 * Generates a new API key with the format lemma_{random_string}
 * @returns A new API key string
 */
export function generateApiKey(): string {
  // Generate 32 random bytes and convert to hex
  const randomString = randomBytes(32).toString('hex')
  return `lemma_${randomString}`
}

/**
 * Validates if a string is a valid API key format
 * @param key The key to validate
 * @returns True if the key starts with 'lemma_' and has the correct length
 */
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith('lemma_') && key.length === 70 // lemma_ (6) + 64 hex chars
}

/**
 * OAuth access tokens are issued with the `lemm_access_token_` prefix
 * (distinct from the `lemma_` API-key prefix).
 * @param token The bearer token to check
 * @returns True if the token looks like an OAuth access token
 */
export function isOAuthAccessToken(token: string): boolean {
  return token.startsWith('lemm_access_token_')
}
