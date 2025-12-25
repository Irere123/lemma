import { env } from '@api/env-runtime'

export function getFromEmailAddress(): string {
  return `noreply@${env.RESEND_DOMAIN}`
}

export function getEmailSubject(
  type:
    | 'sign-in'
    | 'email-verification'
    | 'forget-password'
    | 'reset-password'
    | 'invitation'
    | 'batch-invitation'
    | 'help-confirmation'
    | 'enterprise-subscription'
    | 'usage-threshold'
    | 'free-tier-upgrade'
    | 'plan-welcome-pro'
    | 'plan-welcome-team'
    | 'credit-purchase'
): string {
  const brandName = 'Lemma'

  switch (type) {
    case 'sign-in':
      return `Sign in to ${brandName}`
    case 'email-verification':
      return `Verify your email for ${brandName}`
    case 'forget-password':
      return `Reset your ${brandName} password`
    case 'reset-password':
      return `Reset your ${brandName} password`
    default:
      return brandName
  }
}
