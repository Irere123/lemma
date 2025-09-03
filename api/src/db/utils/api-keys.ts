import { randomBytes } from "node:crypto";

/**
 * Generates a new API key with the format brain_{random_string}
 * @returns A new API key string
 */
export function generateApiKey(): string {
  // Generate 32 random bytes and convert to hex
  const randomString = randomBytes(32).toString("hex");
  return `brain_${randomString}`;
}

/**
 * Validates if a string is a valid API key format
 * @param key The key to validate
 * @returns True if the key starts with 'brain_' and has the correct length
 */
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith("brain_") && key.length === 70; // brain_ (6) + 64 hex chars
}
