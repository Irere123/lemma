import slugify from '@sindresorhus/slugify'
import { desc, eq } from 'drizzle-orm'

import type { DB } from '@api/db'
import { oauthApplications, user } from '@api/db/schema'
import { hash } from '@api/lib/encryption'
import { generateId } from '@api/lib/utils'

async function generateUniqueSlug(db: DB, name: string): Promise<string> {
  const baseSlug = slugify(name, { lowercase: true })

  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await db
      .select({ id: oauthApplications.id })
      .from(oauthApplications)
      .where(eq(oauthApplications.slug, slug))
      .limit(1)

    if (existing.length === 0) {
      return slug
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }
}

export type OAuthApplication = {
  id: string
  name: string
  slug: string
  description: string | null
  overview: string | null
  logoUrl: string | null
  website: string | null
  installUrl: string | null
  screenshots: string[]
  redirectUris: string[]
  clientId: string
  scopes: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
  isPublic: boolean
  active: boolean
  status: 'draft' | 'pending' | 'approved' | 'rejected'
}

export type CreateOAuthApplicationParams = {
  name: string
  description?: string
  overview?: string
  logoUrl?: string
  website?: string
  installUrl?: string
  screenshots?: string[]
  redirectUris: string[]
  scopes: string[]
  createdBy: string
  isPublic?: boolean
}

export type UpdateOAuthApplicationParams = {
  id: string
  name?: string
  description?: string
  overview?: string
  logoUrl?: string
  website?: string
  installUrl?: string
  screenshots?: string[]
  redirectUris?: string[]
  scopes?: string[]
  isPublic?: boolean
  active?: boolean
  status?: 'draft' | 'pending' | 'approved' | 'rejected'
}

export type DeleteOAuthApplicationParams = {
  id: string
}

// Generate client credentials
function generateClientCredentials() {
  const clientId = `lemm_client_${generateId()}`
  const clientSecret = `lemm_app_secret_${generateId()}`
  const clientSecretHash = hash(clientSecret)

  return {
    clientId,
    clientSecret, // Return plain text for initial response
    clientSecretHash, // Store hash in database
  }
}

// Create OAuth application
export async function createOAuthApplication(db: DB, params: CreateOAuthApplicationParams) {
  const { clientId, clientSecret, clientSecretHash } = generateClientCredentials()

  // Generate unique slug
  const slug = await generateUniqueSlug(db, params.name)

  const [result] = await db
    .insert(oauthApplications)
    .values({
      id: generateId(),
      ...params,
      slug,
      clientId,
      clientSecret: clientSecretHash, // Store hashed secret
    })
    .returning({
      id: oauthApplications.id,
      name: oauthApplications.name,
      slug: oauthApplications.slug,
      description: oauthApplications.description,
      overview: oauthApplications.overview,
      logoUrl: oauthApplications.logoUrl,
      website: oauthApplications.website,
      installUrl: oauthApplications.installUrl,
      screenshots: oauthApplications.screenshots,
      redirectUris: oauthApplications.redirectUris,
      clientId: oauthApplications.clientId,
      scopes: oauthApplications.scopes,
      createdBy: oauthApplications.createdBy,
      createdAt: oauthApplications.createdAt,
      updatedAt: oauthApplications.updatedAt,
      isPublic: oauthApplications.isPublic,
      active: oauthApplications.active,
      status: oauthApplications.status,
    })

  return {
    ...result,
    clientSecret, // Return plain text secret only once
  }
}

// Get OAuth applications for a team
export async function getOAuthApplications(db: DB) {
  return db
    .select({
      id: oauthApplications.id,
      name: oauthApplications.name,
      slug: oauthApplications.slug,
      description: oauthApplications.description,
      overview: oauthApplications.overview,
      logoUrl: oauthApplications.logoUrl,
      website: oauthApplications.website,
      installUrl: oauthApplications.installUrl,
      screenshots: oauthApplications.screenshots,
      redirectUris: oauthApplications.redirectUris,
      clientId: oauthApplications.clientId,
      scopes: oauthApplications.scopes,
      createdBy: oauthApplications.createdBy,
      createdAt: oauthApplications.createdAt,
      updatedAt: oauthApplications.updatedAt,
      isPublic: oauthApplications.isPublic,
      active: oauthApplications.active,
      status: oauthApplications.status,
      createdByUser: {
        id: user.id,
        fullName: user.name,
        avatarUrl: user.image,
      },
    })
    .from(oauthApplications)
    .leftJoin(user, eq(oauthApplications.createdBy, user.id))

    .orderBy(desc(oauthApplications.createdAt))
}

// Get OAuth application by ID
export async function getOAuthApplicationById(db: DB, id: string) {
  const [result] = await db
    .select({
      id: oauthApplications.id,
      name: oauthApplications.name,
      slug: oauthApplications.slug,
      description: oauthApplications.description,
      overview: oauthApplications.overview,
      logoUrl: oauthApplications.logoUrl,
      website: oauthApplications.website,
      installUrl: oauthApplications.installUrl,
      screenshots: oauthApplications.screenshots,
      redirectUris: oauthApplications.redirectUris,
      clientId: oauthApplications.clientId,
      scopes: oauthApplications.scopes,
      createdBy: oauthApplications.createdBy,
      createdAt: oauthApplications.createdAt,
      updatedAt: oauthApplications.updatedAt,
      isPublic: oauthApplications.isPublic,
      active: oauthApplications.active,
      status: oauthApplications.status,
      createdByUser: {
        id: user.id,
        fullName: user.name,
        avatarUrl: user.image,
      },
    })
    .from(oauthApplications)
    .leftJoin(user, eq(oauthApplications.createdBy, user.id))

    .limit(1)

  return result
}

// Get OAuth application by client ID
export async function getOAuthApplicationByClientId(db: DB, clientId: string) {
  const [result] = await db
    .select({
      id: oauthApplications.id,
      name: oauthApplications.name,
      slug: oauthApplications.slug,
      description: oauthApplications.description,
      overview: oauthApplications.overview,
      logoUrl: oauthApplications.logoUrl,
      website: oauthApplications.website,
      installUrl: oauthApplications.installUrl,
      screenshots: oauthApplications.screenshots,
      redirectUris: oauthApplications.redirectUris,
      clientId: oauthApplications.clientId,
      clientSecret: oauthApplications.clientSecret,
      scopes: oauthApplications.scopes,
      createdBy: oauthApplications.createdBy,
      createdAt: oauthApplications.createdAt,
      updatedAt: oauthApplications.updatedAt,
      isPublic: oauthApplications.isPublic,
      active: oauthApplications.active,
      status: oauthApplications.status,
    })
    .from(oauthApplications)
    .where(eq(oauthApplications.clientId, clientId))
    .limit(1)

  return result
}

// Get OAuth application by slug
export async function getOAuthApplicationBySlug(db: DB, slug: string) {
  const [result] = await db
    .select({
      id: oauthApplications.id,
      name: oauthApplications.name,
      slug: oauthApplications.slug,
      description: oauthApplications.description,
      overview: oauthApplications.overview,
      logoUrl: oauthApplications.logoUrl,
      website: oauthApplications.website,
      installUrl: oauthApplications.installUrl,
      screenshots: oauthApplications.screenshots,
      redirectUris: oauthApplications.redirectUris,
      clientId: oauthApplications.clientId,
      scopes: oauthApplications.scopes,
      createdBy: oauthApplications.createdBy,
      createdAt: oauthApplications.createdAt,
      updatedAt: oauthApplications.updatedAt,
      isPublic: oauthApplications.isPublic,
      active: oauthApplications.active,
      status: oauthApplications.status,
      createdByUser: {
        id: user.id,
        fullName: user.name,
        avatarUrl: user.image,
      },
    })
    .from(oauthApplications)
    .leftJoin(user, eq(oauthApplications.createdBy, user.id))
    .where(eq(oauthApplications.slug, slug))
    .limit(1)

  return result
}

// Update OAuth application
export async function updateOAuthApplication(db: DB, params: UpdateOAuthApplicationParams) {
  const { id, ...updateData } = params

  // If name is being updated, regenerate the slug
  let slug: string | undefined
  if (updateData.name) {
    slug = await generateUniqueSlug(db, updateData.name)
  }

  const [result] = await db
    .update(oauthApplications)
    .set({
      ...updateData,
      ...(slug && { slug }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(oauthApplications.id, id))
    .returning({
      id: oauthApplications.id,
      name: oauthApplications.name,
      slug: oauthApplications.slug,
      description: oauthApplications.description,
      overview: oauthApplications.overview,
      logoUrl: oauthApplications.logoUrl,
      website: oauthApplications.website,
      installUrl: oauthApplications.installUrl,
      screenshots: oauthApplications.screenshots,
      redirectUris: oauthApplications.redirectUris,
      clientId: oauthApplications.clientId,
      scopes: oauthApplications.scopes,
      createdBy: oauthApplications.createdBy,
      createdAt: oauthApplications.createdAt,
      updatedAt: oauthApplications.updatedAt,
      isPublic: oauthApplications.isPublic,
      active: oauthApplications.active,
      status: oauthApplications.status,
    })

  return result
}

// Update OAuth application approval status
export async function updateOAuthApplicationStatus(
  db: DB,
  params: {
    id: string
    status: 'draft' | 'pending' | 'approved' | 'rejected'
  }
) {
  const { id, status } = params

  const [result] = await db
    .update(oauthApplications)
    .set({
      status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(oauthApplications.id, id))
    .returning({
      id: oauthApplications.id,
      name: oauthApplications.name,
      status: oauthApplications.status,
    })

  return result
}

// Delete OAuth application
export async function deleteOAuthApplication(db: DB, params: DeleteOAuthApplicationParams) {
  const [result] = await db
    .delete(oauthApplications)
    .where(eq(oauthApplications.id, params.id))
    .returning({
      id: oauthApplications.id,
      name: oauthApplications.name,
    })

  return result
}

// Regenerate client secret
export async function regenerateClientSecret(db: DB, id: string) {
  const clientSecret = `lemm_app_secret_${generateId()}`
  const clientSecretHash = hash(clientSecret)

  const [result] = await db
    .update(oauthApplications)
    .set({
      clientSecret: clientSecretHash, // Store hashed secret
      updatedAt: new Date().toISOString(),
    })
    .where(eq(oauthApplications.id, id))
    .returning({
      id: oauthApplications.id,
      clientId: oauthApplications.clientId,
    })

  if (!result) {
    return null
  }

  return {
    ...result,
    clientSecret, // Return plain text secret only once
  }
}
