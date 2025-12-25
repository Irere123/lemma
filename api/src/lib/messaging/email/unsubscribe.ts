import { env } from '@api/env-runtime'
import { createHash, randomBytes } from 'node:crypto'
import type { EmailType } from './mailer'

export interface EmailPreferences {
    unsubscribeAll?: boolean
    unsubscribeMarketing?: boolean
    unsubscribeUpdates?: boolean
    unsubscribeNotifications?: boolean
  }


  /**
 * Generate a secure unsubscribe token for an email address
 */
export function generateUnsubscribeToken(email: string, emailType = 'marketing'): string {
    const salt = randomBytes(16).toString('hex')
    const hash = createHash('sha256')
      .update(`${email}:${salt}:${emailType}:${env.BETTER_AUTH_SECRET}`)
      .digest('hex')
  
    return `${salt}:${hash}:${emailType}`
  }


  /**
 * Verify an unsubscribe token for an email address and return email type
 */
export function verifyUnsubscribeToken(
    email: string,
    token: string
  ): { valid: boolean; emailType?: string } {
    try {
      const parts = token.split(':')
      if (parts.length < 2) return { valid: false }
  
      // Handle legacy tokens (without email type)
      if (parts.length === 2) {
        const [salt, expectedHash] = parts
        const hash = createHash('sha256')
          .update(`${email}:${salt}:${env.BETTER_AUTH_SECRET}`)
          .digest('hex')
  
        return { valid: hash === expectedHash, emailType: 'marketing' }
      }
  
      // Handle new tokens (with email type)
      const [salt, expectedHash, emailType] = parts
      if (!salt || !expectedHash || !emailType) return { valid: false }
  
      const hash = createHash('sha256')
        .update(`${email}:${salt}:${emailType}:${env.BETTER_AUTH_SECRET}`)
        .digest('hex')
  
      return { valid: hash === expectedHash, emailType }
    } catch (error) {
      console.error('Error verifying unsubscribe token:', error)
      return { valid: false }
    }
  }
  

  /**
 * Check if an email type is transactional
 */
export function isTransactionalEmail(emailType: EmailType): boolean {
    return emailType === ('transactional' as EmailType)
  }
  

  /**
 * TODO: Get user/subscriber's email preferences
 */


  /**
 * TODO: Unsubscribe user from all emails
 */


  /**
 * TODO: Resubscribe user (remove all unsubscribe flags)
 */


  /**
 * TODO: Update user/subscriber email preferences
 */