import { and, eq, desc, ne, gte } from 'drizzle-orm'
import type { DB } from '@api/db'
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceInvite,
  type WorkspaceRole,
} from '@api/db/schema'
import { generateId } from '@api/lib/utils'
import { slugifyString } from '@api/db/utils/slugify'

// Workspace CRUD
export type CreateWorkspaceData = {
  name: string
  description?: string
  logoUrl?: string
  domain?: string
  ownerId: string
  settings?: {
    allowPublicSignup?: boolean
    defaultRole?: 'EDITOR' | 'VIEWER'
    brandColor?: string
    customCss?: string
  }
}

export type UpdateWorkspaceData = {
  id: string
  name?: string
  description?: string
  logoUrl?: string
  domain?: string
  settings?: {
    allowPublicSignup?: boolean
    defaultRole?: 'EDITOR' | 'VIEWER'
    brandColor?: string
    customCss?: string
  }
  isActive?: boolean
}

async function ensureUniqueWorkspaceSlug(
  db: DB,
  base: string,
  excludeId?: string
): Promise<string> {
  let candidate = base || 'workspace'
  let suffix = 0

  while (true) {
    const whereClause = excludeId
      ? and(eq(workspaces.slug, candidate), ne(workspaces.id, excludeId))
      : eq(workspaces.slug, candidate)

    const existing = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(whereClause)
      .limit(1)

    if (existing.length === 0) return candidate
    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

export const createWorkspace = async (db: DB, data: CreateWorkspaceData): Promise<Workspace> => {
  const slug = await ensureUniqueWorkspaceSlug(db, slugifyString(data.name) || 'workspace')

  const [workspace] = await db
    .insert(workspaces)
    .values({
      id: generateId('ws'),
      name: data.name,
      slug,
      description: data.description,
      logoUrl: data.logoUrl,
      domain: data.domain,
      ownerId: data.ownerId,
      settings: data.settings,
    })
    .returning()

  if (!workspace) {
    throw new Error('Failed to create workspace')
  }

  // Add owner as a member with OWNER role
  await db.insert(workspaceMembers).values({
    id: generateId('wm'),
    workspaceId: workspace.id,
    userId: data.ownerId,
    role: 'OWNER',
    joinedAt: new Date(),
  })

  return workspace
}

export const updateWorkspace = async (
  db: DB,
  data: UpdateWorkspaceData
): Promise<Workspace | undefined> => {
  const updateValues: any = { updatedAt: new Date() }

  if (data.name !== undefined) {
    updateValues.name = data.name
    updateValues.slug = await ensureUniqueWorkspaceSlug(
      db,
      slugifyString(data.name) || 'workspace',
      data.id
    )
  }
  if (data.description !== undefined) updateValues.description = data.description
  if (data.logoUrl !== undefined) updateValues.logoUrl = data.logoUrl
  if (data.domain !== undefined) updateValues.domain = data.domain
  if (data.settings !== undefined) updateValues.settings = data.settings
  if (data.isActive !== undefined) updateValues.isActive = data.isActive

  const [workspace] = await db
    .update(workspaces)
    .set(updateValues)
    .where(eq(workspaces.id, data.id))
    .returning()

  return workspace
}

export const getWorkspaceById = async (db: DB, id: string): Promise<Workspace | undefined> => {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)

  return workspace
}

export const getWorkspaceBySlug = async (db: DB, slug: string): Promise<Workspace | undefined> => {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1)

  return workspace
}

export const getWorkspaceByDomain = async (
  db: DB,
  domain: string
): Promise<Workspace | undefined> => {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.domain, domain))
    .limit(1)

  return workspace
}

export const getUserWorkspaces = async (db: DB, userId: string): Promise<Workspace[]> => {
  const memberships = await db
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.isActive, true)))
    .orderBy(desc(workspaces.createdAt))

  return memberships.map((m) => m.workspace)
}

export const deleteWorkspace = async (db: DB, id: string): Promise<void> => {
  await db.delete(workspaces).where(eq(workspaces.id, id))
}

// Workspace Members
export const addWorkspaceMember = async (
  db: DB,
  data: {
    workspaceId: string
    userId: string
    role: WorkspaceRole
    invitedBy?: string
  }
): Promise<WorkspaceMember> => {
  const [member] = await db
    .insert(workspaceMembers)
    .values({
      id: generateId('wm'),
      workspaceId: data.workspaceId,
      userId: data.userId,
      role: data.role,
      invitedBy: data.invitedBy,
      joinedAt: new Date(),
    })
    .returning()

  if (!member) {
    throw new Error('Failed to create workspace member')
  }

  return member
}

export const updateWorkspaceMemberRole = async (
  db: DB,
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
): Promise<WorkspaceMember | undefined> => {
  const [member] = await db
    .update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .returning()

  return member
}

export const removeWorkspaceMember = async (
  db: DB,
  workspaceId: string,
  userId: string
): Promise<void> => {
  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
}

export const getWorkspaceMembers = async (
  db: DB,
  workspaceId: string
): Promise<WorkspaceMember[]> => {
  return db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.isActive, true)))
}

export const getWorkspaceMember = async (
  db: DB,
  workspaceId: string,
  userId: string
): Promise<WorkspaceMember | undefined> => {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1)

  return member
}

export const isWorkspaceMember = async (
  db: DB,
  workspaceId: string,
  userId: string
): Promise<boolean> => {
  const member = await getWorkspaceMember(db, workspaceId, userId)
  return !!member && member.isActive === true
}

export const hasWorkspaceRole = async (
  db: DB,
  workspaceId: string,
  userId: string,
  roles: WorkspaceRole[]
): Promise<boolean> => {
  const member = await getWorkspaceMember(db, workspaceId, userId)
  return !!member && member.isActive === true && member.role !== null && roles.includes(member.role)
}

// Workspace Invites
export const createWorkspaceInvite = async (
  db: DB,
  data: {
    workspaceId: string
    email: string
    role: WorkspaceRole
    invitedBy: string
    expiresInDays?: number
  }
): Promise<WorkspaceInvite> => {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7))

  const [invite] = await db
    .insert(workspaceInvites)
    .values({
      id: generateId('inv'),
      workspaceId: data.workspaceId,
      email: data.email,
      role: data.role,
      token: generateId('invt'),
      invitedBy: data.invitedBy,
      expiresAt,
    })
    .returning()

  if (!invite) {
    throw new Error('Failed to create workspace invite')
  }

  return invite
}

export const getWorkspaceInviteByToken = async (
  db: DB,
  token: string
): Promise<WorkspaceInvite | undefined> => {
  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.token, token), gte(workspaceInvites.expiresAt, new Date())))
    .limit(1)

  return invite
}

export const acceptWorkspaceInvite = async (
  db: DB,
  token: string,
  userId: string
): Promise<WorkspaceMember | undefined> => {
  const invite = await getWorkspaceInviteByToken(db, token)
  if (!invite || invite.acceptedAt) return undefined

  await db
    .update(workspaceInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(workspaceInvites.id, invite.id))

  return addWorkspaceMember(db, {
    workspaceId: invite.workspaceId,
    userId,
    role: invite.role || 'VIEWER',
    invitedBy: invite.invitedBy,
  })
}

export const getPendingInvites = async (
  db: DB,
  workspaceId: string
): Promise<WorkspaceInvite[]> => {
  return db
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        gte(workspaceInvites.expiresAt, new Date())
      )
    )
}

export const deleteWorkspaceInvite = async (db: DB, id: string): Promise<void> => {
  await db.delete(workspaceInvites).where(eq(workspaceInvites.id, id))
}
