import { render } from '@react-email/render'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, oneTimeToken } from 'better-auth/plugins'

import { createDb } from '@api/db'
import * as schema from '@api/db/schema'
import { env } from '@api/env-runtime'
import { sendEmail } from '@api/lib/messaging/email/mailer'
import { getEmailSubject, getFromEmailAddress } from '@api/lib/messaging/email/utils'
import { quickValidateEmail } from '@api/lib/messaging/email/validation'

export const createAuth = () => {
  const { db } = createDb(env.DATABASE_URL)

  return betterAuth({
    basePath: '/auth',
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [...env.ALLOWED_API_ORIGINS.split(',')],
    advanced: {
      cookiePrefix: 'lemma',
      crossSubDomainCookies: {
        enabled: env.ENV === 'production',
        domain: '.irere.dev',
      },
      useSecureCookies: env.ENV === 'production',
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 24 * 60 * 60, // 24 hours in seconds
      },
      expiresIn: 30 * 24 * 60 * 60, // 30 days (how long a session can last overall)
      updateAge: 24 * 60 * 60, // 24 hours (how often to refresh the expiry)
      freshAge: 60 * 60, // 1 hour (or set to 0 to disable completely)
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scopes: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendVerificationOnSignUp: false,
      throwOnMissingCredentials: true,
      throwOnInvalidCredentials: true,
      sendResetPassword: async ({ user, url, token }, request) => {
        const { ResetPassword } = await import('@lemma/email/emails/reset-password')
        const html = await render(
          ResetPassword({
            user: {
              name: user.name,
              email: user.email,
            },
            url,
            token,
            baseUrl: env.FRONTEND_URL,
          })
        )

        const result = await sendEmail({
          to: user.email,
          subject: getEmailSubject('reset-password'),
          html,
          from: getFromEmailAddress(),
          emailType: 'transactional',
        })

        if (!result.success) {
          throw new Error(`Failed to send reset password email: ${result.message}`)
        }
      },
    },

    plugins: [
      oneTimeToken({
        expiresIn: 10 * 60, // 10 minutes in seconds
      }),
      emailOTP({
        sendVerificationOTP: async (data: {
          email: string
          otp: string
          type: 'sign-in' | 'email-verification' | 'forget-password'
        }) => {
          const { OTPVerification } = await import('@lemma/email/emails/otp-verification')

          try {
            if (!data.email) {
              throw new Error('Email is required')
            }

            const validation = quickValidateEmail(data.email)
            if (!validation.isValid) {
              console.warn('Email validation failed', {
                email: data.email,
                reason: validation.reason,
                checks: validation.checks,
              })
              throw new Error(
                validation.reason ||
                  "We are unable to deliver the verification email to that address. Please make sure it's valid and able to receive emails."
              )
            }

            const html = await render(
              OTPVerification({
                user: {
                  name: data.email,
                  email: data.email,
                },
                otp: data.otp,
              })
            )

            const result = await sendEmail({
              to: data.email,
              subject: getEmailSubject(data.type),
              html,
              from: getFromEmailAddress(),
              emailType: 'transactional',
            })

            if (!result.success && result.message.includes('no email service configured')) {
              console.info('🔑 VERIFICATION CODE FOR LOGIN/SIGNUP', {
                email: data.email,
                otp: data.otp,
                type: data.type,
                validation: validation.checks,
              })
              return
            }

            if (!result.success) {
              throw new Error(`Failed to send verification code: ${result.message}`)
            }
          } catch (error) {
            console.error('Error sending verification code:', {
              error,
              email: data.email,
            })
            throw error
          }
        },
        sendVerificationOnSignUp: false,
        otpLength: 6, // Explicitly set the OTP length
        expiresIn: 15 * 60, // 15 minutes in seconds
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
