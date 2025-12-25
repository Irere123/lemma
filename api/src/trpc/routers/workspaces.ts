import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  acceptWorkspaceInvite,
  createWorkspace,
  createWorkspaceInvite,
  deleteWorkspace,
  deleteWorkspaceInvite,
  getPendingInvites,
  getUserWorkspaces,
  getWorkspaceById,
  getWorkspaceBySlug,
  getWorkspaceInviteByToken,
  getWorkspaceMember,
  getWorkspaceMembers,
  hasWorkspaceRole,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMemberRole,
} from '@api/db/queries/workspaces'
import { env } from '@api/env-runtime'
import { enqueueSingleEmail } from '@api/jobs/producers'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@api/trpc/init'

const workspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'])

const workspaceSettingsSchema = z.object({
  allowPublicSignup: z.boolean().optional(),
  defaultRole: z.enum(['EDITOR', 'VIEWER']).optional(),
  brandColor: z.string().optional(),
  customCss: z.string().optional(),
})

export const workspacesRouter = createTRPCRouter({
  // List user's workspaces
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserWorkspaces(ctx.db, ctx.user.id)
  }),

  // Get workspace by ID
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const workspace = await getWorkspaceById(ctx.db, input.id)

    if (!workspace) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Workspace not found',
      })
    }

    // Check if user is a member
    const member = await getWorkspaceMember(ctx.db, input.id, ctx.user.id)
    if (!member) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this workspace',
      })
    }

    return { workspace, role: member.role }
  }),

  // Get workspace by slug
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const workspace = await getWorkspaceBySlug(ctx.db, input.slug)

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found',
        })
      }

      const member = await getWorkspaceMember(ctx.db, workspace.id, ctx.user.id)
      if (!member) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a member of this workspace',
        })
      }

      return { workspace, role: member.role }
    }),

  // Create workspace
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        logoUrl: z.string().url().optional(),
        domain: z.string().optional(),
        settings: workspaceSettingsSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await createWorkspace(ctx.db, {
        ...input,
        ownerId: ctx.user.id,
      })

      return workspace
    }),

  // Update workspace
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        logoUrl: z.string().url().optional(),
        domain: z.string().optional(),
        settings: workspaceSettingsSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has admin access
      const hasAccess = await hasWorkspaceRole(ctx.db, input.id, ctx.user.id, ['OWNER', 'ADMIN'])
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this workspace',
        })
      }

      const workspace = await updateWorkspace(ctx.db, input)
      return workspace
    }),

  // Delete workspace
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await getWorkspaceById(ctx.db, input.id)

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found',
        })
      }

      // Only owner can delete
      if (workspace.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the workspace owner can delete it',
        })
      }

      await deleteWorkspace(ctx.db, input.id)
      return { success: true }
    }),

  // Get workspace members
  members: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const isMember = await getWorkspaceMember(ctx.db, input.workspaceId, ctx.user.id)
      if (!isMember) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a member of this workspace',
        })
      }

      return getWorkspaceMembers(ctx.db, input.workspaceId)
    }),

  // Update member role
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        userId: z.string(),
        role: workspaceRoleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has admin access
      const hasAccess = await hasWorkspaceRole(ctx.db, input.workspaceId, ctx.user.id, [
        'OWNER',
        'ADMIN',
      ])
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update member roles',
        })
      }

      // Cannot change owner role
      const workspace = await getWorkspaceById(ctx.db, input.workspaceId)
      if (workspace?.ownerId === input.userId && input.role !== 'OWNER') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot change the owner role',
        })
      }

      const member = await updateWorkspaceMemberRole(
        ctx.db,
        input.workspaceId,
        input.userId,
        input.role
      )

      return member
    }),

  // Remove member
  removeMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has admin access or is removing themselves
      const hasAccess = await hasWorkspaceRole(ctx.db, input.workspaceId, ctx.user.id, [
        'OWNER',
        'ADMIN',
      ])
      const isSelf = input.userId === ctx.user.id

      if (!hasAccess && !isSelf) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to remove members',
        })
      }

      // Cannot remove owner
      const workspace = await getWorkspaceById(ctx.db, input.workspaceId)
      if (workspace?.ownerId === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot remove the workspace owner',
        })
      }

      await removeWorkspaceMember(ctx.db, input.workspaceId, input.userId)
      return { success: true }
    }),

  // Invite member
  invite: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
        role: workspaceRoleSchema.optional().default('VIEWER'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has admin access
      const hasAccess = await hasWorkspaceRole(ctx.db, input.workspaceId, ctx.user.id, [
        'OWNER',
        'ADMIN',
      ])
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to invite members',
        })
      }

      const workspace = await getWorkspaceById(ctx.db, input.workspaceId)
      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found',
        })
      }

      const invite = await createWorkspaceInvite(ctx.db, {
        workspaceId: input.workspaceId,
        email: input.email,
        role: input.role,
        invitedBy: ctx.user.id,
      })

      // Send invitation email
      const inviteUrl = `${env.FRONTEND_URL}/invite?token=${invite.token}`
      await enqueueSingleEmail({
        to: input.email,
        subject: `You've been invited to join ${workspace.name}`,
        html: `
          <h2>Workspace Invitation</h2>
          <p>You've been invited to join <strong>${workspace.name}</strong> as a ${input.role}.</p>
          <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
          <p>This invitation expires in 7 days.</p>
        `,
      })

      return invite
    }),

  // Get pending invites
  pendingInvites: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const hasAccess = await hasWorkspaceRole(ctx.db, input.workspaceId, ctx.user.id, [
        'OWNER',
        'ADMIN',
      ])
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view invites',
        })
      }

      return getPendingInvites(ctx.db, input.workspaceId)
    }),

  // Cancel invite
  cancelInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteWorkspaceInvite(ctx.db, input.inviteId)
      return { success: true }
    }),

  // Accept invite (public)
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await getWorkspaceInviteByToken(ctx.db, input.token)

      if (!invite) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invite not found or expired',
        })
      }

      const member = await acceptWorkspaceInvite(ctx.db, input.token, ctx.user.id)

      if (!member) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not accept invite',
        })
      }

      const workspace = await getWorkspaceById(ctx.db, invite.workspaceId)

      return { success: true, workspace }
    }),

  // Get invite details (public)
  getInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const invite = await getWorkspaceInviteByToken(ctx.db, input.token)

      if (!invite) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invite not found or expired',
        })
      }

      const workspace = await getWorkspaceById(ctx.db, invite.workspaceId)

      return {
        email: invite.email,
        role: invite.role,
        workspaceName: workspace?.name,
        expiresAt: invite.expiresAt,
      }
    }),
})
