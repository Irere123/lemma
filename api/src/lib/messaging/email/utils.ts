import { env } from '@api/env-runtime'

export function getFromEmailAddress(): string {
  return `noreply@${env.RESEND_DOMAIN}`
}