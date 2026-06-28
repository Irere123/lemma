import {
  createAuthorizationCode,
  createOAuthApplication,
  deleteOAuthApplication,
  getOAuthApplicationByClientId,
  getOAuthApplicationById,
  getOAuthApplications,
  getUserAuthorizedApplications,
  hasUserEverAuthorizedApp,
  regenerateClientSecret,
  revokeUserApplicationTokens,
  updateOAuthApplication,
  updateOAuthApplicationStatus,
} from '@api/db/queries'
import { sendEmail } from '@api/lib/messaging/email/mailer'
import {
  authorizeOAuthApplicationSchema,
  createOAuthApplicationSchema,
  deleteOAuthApplicationSchema,
  getApplicationInfoSchema,
  getOAuthApplicationSchema,
  regenerateClientSecretSchema,
  updateApprovalStatusSchema,
  updateOAuthApplicationSchema,
} from '@api/schemas/oauth-applications'
import { revokeUserApplicationAccessSchema } from '@api/schemas/oauth-flow'
import { createTRPCRouter, protectedProcedure } from '@api/trpc/init'
import { TRPCError } from '@trpc/server'

export const oauthApplicationsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx

    const allApplications = await getOAuthApplications(db)
    const applications = allApplications.filter((app) => app.createdBy === user.id)

    return {
      data: applications,
    }
  }),

  getApplicationInfo: protectedProcedure
    .input(getApplicationInfoSchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx
      const { clientId, redirectUri, scope, state } = input

      const application = await getOAuthApplicationByClientId(db, clientId)
      if (!application || !application.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid client_id' })
      }

      if (!application.redirectUris.includes(redirectUri)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid redirect_uri' })
      }

      const requestedScopes = scope.split(' ').filter(Boolean)
      const invalidScopes = requestedScopes.filter((s) => !application.scopes.includes(s))

      if (invalidScopes.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid scopes: ${invalidScopes.join(', ')}` })
      }

      return {
        id: application.id,
        name: application.name,
        description: application.description,
        overview: application.overview,
        logoUrl: application.logoUrl,
        website: application.website,
        installUrl: application.installUrl,
        screenshots: application.screenshots,
        clientId: application.clientId,
        scopes: requestedScopes,
        redirectUri: redirectUri,
        state,
        status: application.status,
      }
    }),

  authorize: protectedProcedure
    .input(authorizeOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx
      const { clientId, decision, scopes, redirectUri, state, codeChallenge } = input

      // Validate client_id first (needed for both allow and deny)
      const application = await getOAuthApplicationByClientId(db, clientId)
      if (!application || !application.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid client_id' })
      }

      // Validate scopes against application's registered scopes (prevent privilege escalation)
      const invalidScopes = scopes.filter((scope) => !application.scopes.includes(scope))

      if (invalidScopes.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid scopes: ${invalidScopes.join(', ')}` })
      }

      const redirectUrl = new URL(redirectUri)

      // Handle denial early
      if (decision === 'deny') {
        redirectUrl.searchParams.set('error', 'access_denied')
        redirectUrl.searchParams.set('error_description', 'User denied access')
        if (state) {
          redirectUrl.searchParams.set('state', state)
        }
        return { redirect_url: redirectUrl.toString() }
      }

      // Enforce PKCE for public clients
      if (application.isPublic && !codeChallenge) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'PKCE is required for public clients' })
      }

      const authCode = await createAuthorizationCode(db, {
        applicationId: application.id,
        userId: user.id,
        scopes,
        redirectUri,
        codeChallenge,
      })

      if (!authCode) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create authorization code' })
      }

      // Send app installation email only if this is the first time authorizing this app
      try {
        // Check if user has ever authorized this application (including expired tokens)
        const hasAuthorizedBefore = await hasUserEverAuthorizedApp(db, user.id, application.id)

        if (!hasAuthorizedBefore && user.email) {
          await sendEmail({
            to: user.email,
            subject: `App Installed: ${application.name}`,
            html: `
                <h2>App Installed</h2>
                <p>You have successfully installed <strong>${application.name}</strong>.</p>
                <p>This app now has access to your account based on the permissions you granted.</p>
              `,
            emailType: 'transactional',
          })
        }
      } catch (error) {
        // Log error but don't fail the OAuth flow
        console.error('Failed to send app installation email:', error)
      }

      redirectUrl.searchParams.set('code', authCode.code)
      if (state) {
        redirectUrl.searchParams.set('state', state)
      }

      return { redirect_url: redirectUrl.toString() }
    }),

  create: protectedProcedure
    .input(createOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx

      const application = await createOAuthApplication(db, {
        ...input,
        createdBy: user.id,
      })

      return application
    }),

  get: protectedProcedure.input(getOAuthApplicationSchema).query(async ({ ctx, input }) => {
    const { db, user } = ctx

    const application = await getOAuthApplicationById(db, input.id)

    if (!application) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
    }

    if (application.createdBy !== user.id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
    }

    return application
  }),

  update: protectedProcedure
    .input(updateOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx
      const { id, ...updateData } = input

      const existingApp = await getOAuthApplicationById(db, id)
      if (!existingApp || existingApp.createdBy !== user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      const application = await updateOAuthApplication(db, {
        ...updateData,
        id,
      })

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      return application
    }),

  delete: protectedProcedure
    .input(deleteOAuthApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx

      const existingApp = await getOAuthApplicationById(db, input.id)
      if (!existingApp || existingApp.createdBy !== user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      const result = await deleteOAuthApplication(db, {
        id: input.id,
      })

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      return { success: true }
    }),

  regenerateSecret: protectedProcedure
    .input(regenerateClientSecretSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx

      const existingApp = await getOAuthApplicationById(db, input.id)
      if (!existingApp || existingApp.createdBy !== user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      const result = await regenerateClientSecret(db, input.id)

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      return result
    }),

  authorized: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx

    const applications = await getUserAuthorizedApplications(db, user.id)

    return {
      data: applications,
    }
  }),

  revokeAccess: protectedProcedure
    .input(revokeUserApplicationAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx

      await revokeUserApplicationTokens(db, user.id, input.applicationId)

      return { success: true }
    }),

  updateApprovalStatus: protectedProcedure
    .input(updateApprovalStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx

      const application = await getOAuthApplicationById(db, input.id)

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      if (application.createdBy !== user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      const result = await updateOAuthApplicationStatus(db, {
        id: input.id,
        status: input.status,
      })

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'OAuth application not found' })
      }

      if (input.status === 'pending' && user.email) {
        try {
          await sendEmail({
            to: user.email,
            subject: `Application Review Request - ${application.name}`,
            html: `
                <h2>Application Review Request</h2>
                <p>Your application <strong>${application.name}</strong> has been submitted for review.</p>
                <p>We will review your application and notify you once a decision has been made.</p>
              `,
            emailType: 'transactional',
          })
        } catch (error) {
          // Log error but don't fail the mutation
          console.error('Failed to send application review request:', error)
        }
      }

      return result
    }),
})
