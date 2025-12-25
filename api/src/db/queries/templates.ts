import { and, eq, desc, ne } from 'drizzle-orm'
import type { DB } from '@api/db'
import {
  emailTemplates,
  type EmailTemplate,
  type EmailTemplateInsert,
  type TemplateType,
} from '@api/db/schema'
import { generateId } from '@api/lib/utils'
import { slugifyString } from '@api/db/utils/slugify'

export type CreateTemplateData = {
  name: string
  description?: string
  type?: TemplateType
  subject?: string
  htmlContent?: string
  jsonContent?: any
  previewText?: string
  writerId: string
  isDefault?: boolean
  variables?: string[]
}

export type UpdateTemplateData = {
  id: string
  name?: string
  description?: string
  type?: TemplateType
  subject?: string
  htmlContent?: string
  jsonContent?: any
  previewText?: string
  isDefault?: boolean
  isActive?: boolean
  variables?: string[]
}

async function ensureUniqueTemplateSlug(
  db: DB,
  writerId: string,
  base: string,
  excludeId?: string
): Promise<string> {
  let candidate = base || 'template'
  let suffix = 0

  while (true) {
    const whereClause = excludeId
      ? and(
          eq(emailTemplates.slug, candidate),
          eq(emailTemplates.writerId, writerId),
          ne(emailTemplates.id, excludeId)
        )
      : and(eq(emailTemplates.slug, candidate), eq(emailTemplates.writerId, writerId))

    const existing = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(whereClause)
      .limit(1)

    if (existing.length === 0) return candidate
    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

export const createTemplate = async (db: DB, data: CreateTemplateData): Promise<EmailTemplate> => {
  const slug = await ensureUniqueTemplateSlug(
    db,
    data.writerId,
    slugifyString(data.name) || 'template'
  )

  // If this is set as default, unset other defaults of the same type
  if (data.isDefault && data.type) {
    await db
      .update(emailTemplates)
      .set({ isDefault: false })
      .where(and(eq(emailTemplates.writerId, data.writerId), eq(emailTemplates.type, data.type)))
  }

  const [template] = await db
    .insert(emailTemplates)
    .values({
      id: generateId('tpl'),
      name: data.name,
      slug,
      description: data.description,
      type: data.type || 'CUSTOM',
      subject: data.subject,
      htmlContent: data.htmlContent,
      jsonContent: data.jsonContent,
      previewText: data.previewText,
      writerId: data.writerId,
      isDefault: data.isDefault || false,
      variables: data.variables || [],
    })
    .returning()

  if (!template) {
    throw new Error('Failed to create template')
  }

  return template
}

export const updateTemplate = async (
  db: DB,
  data: UpdateTemplateData
): Promise<EmailTemplate | undefined> => {
  const existing = await getTemplateById(db, data.id)
  if (!existing) return undefined

  const updateValues: any = { updatedAt: new Date() }

  if (data.name !== undefined) {
    updateValues.name = data.name
    updateValues.slug = await ensureUniqueTemplateSlug(
      db,
      existing.writerId,
      slugifyString(data.name) || 'template',
      data.id
    )
  }
  if (data.description !== undefined) updateValues.description = data.description
  if (data.type !== undefined) updateValues.type = data.type
  if (data.subject !== undefined) updateValues.subject = data.subject
  if (data.htmlContent !== undefined) updateValues.htmlContent = data.htmlContent
  if (data.jsonContent !== undefined) updateValues.jsonContent = data.jsonContent
  if (data.previewText !== undefined) updateValues.previewText = data.previewText
  if (data.isActive !== undefined) updateValues.isActive = data.isActive
  if (data.variables !== undefined) updateValues.variables = data.variables

  // Handle default flag
  if (data.isDefault !== undefined) {
    updateValues.isDefault = data.isDefault
    if (data.isDefault) {
      // Unset other defaults of the same type
      const typeToUse = data.type || existing.type
      await db
        .update(emailTemplates)
        .set({ isDefault: false })
        .where(
          and(
            eq(emailTemplates.writerId, existing.writerId),
            eq(emailTemplates.type, typeToUse as TemplateType),
            ne(emailTemplates.id, data.id)
          )
        )
    }
  }

  const [template] = await db
    .update(emailTemplates)
    .set(updateValues)
    .where(eq(emailTemplates.id, data.id))
    .returning()

  return template
}

export const getTemplateById = async (db: DB, id: string): Promise<EmailTemplate | undefined> => {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1)

  return template
}

export const getTemplateBySlug = async (
  db: DB,
  writerId: string,
  slug: string
): Promise<EmailTemplate | undefined> => {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.writerId, writerId), eq(emailTemplates.slug, slug)))
    .limit(1)

  return template
}

export const getTemplatesByWriter = async (
  db: DB,
  writerId: string,
  options?: { type?: TemplateType; activeOnly?: boolean; limit?: number }
): Promise<EmailTemplate[]> => {
  const conditions = [eq(emailTemplates.writerId, writerId)]

  if (options?.type) {
    conditions.push(eq(emailTemplates.type, options.type))
  }

  if (options?.activeOnly) {
    conditions.push(eq(emailTemplates.isActive, true))
  }

  const query = db
    .select()
    .from(emailTemplates)
    .where(and(...conditions))
    .orderBy(desc(emailTemplates.createdAt))

  if (options?.limit) {
    return query.limit(options.limit)
  }

  return query
}

export const getDefaultTemplate = async (
  db: DB,
  writerId: string,
  type: TemplateType
): Promise<EmailTemplate | undefined> => {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.writerId, writerId),
        eq(emailTemplates.type, type),
        eq(emailTemplates.isDefault, true),
        eq(emailTemplates.isActive, true)
      )
    )
    .limit(1)

  return template
}

export const deleteTemplate = async (db: DB, id: string): Promise<void> => {
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id))
}

export const duplicateTemplate = async (
  db: DB,
  templateId: string,
  writerId: string,
  newName?: string
): Promise<EmailTemplate | undefined> => {
  const original = await getTemplateById(db, templateId)
  if (!original) return undefined

  const name = newName || `${original.name} (Copy)`

  return createTemplate(db, {
    name,
    description: original.description || undefined,
    type: original.type || 'CUSTOM',
    subject: original.subject || undefined,
    htmlContent: original.htmlContent || undefined,
    jsonContent: original.jsonContent,
    previewText: original.previewText || undefined,
    writerId,
    isDefault: false,
    variables: original.variables || [],
  })
}

// Template variable helpers
export const extractTemplateVariables = (htmlContent: string): string[] => {
  const regex = /\{\{(\w+)\}\}/g
  const matches = htmlContent.matchAll(regex)
  const variables = new Set<string>()

  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1])
    }
  }

  return Array.from(variables)
}

export const renderTemplate = (htmlContent: string, variables: Record<string, string>): string => {
  let rendered = htmlContent

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(regex, value)
  }

  return rendered
}
