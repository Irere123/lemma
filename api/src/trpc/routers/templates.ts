import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { createTRPCRouter, protectedProcedure } from '@api/trpc/init'
import {
  createTemplate,
  updateTemplate,
  getTemplateById,
  getTemplateBySlug,
  getTemplatesByWriter,
  getDefaultTemplate,
  deleteTemplate,
  duplicateTemplate,
  extractTemplateVariables,
  renderTemplate,
} from '@api/db/queries/templates'

const templateTypeSchema = z.enum([
  'NEWSLETTER',
  'WELCOME',
  'CONFIRMATION',
  'TRANSACTIONAL',
  'CUSTOM',
])

export const templatesRouter = createTRPCRouter({
  // List all templates
  list: protectedProcedure
    .input(
      z
        .object({
          type: templateTypeSchema.optional(),
          activeOnly: z.boolean().optional().default(true),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return getTemplatesByWriter(ctx.db, ctx.user.id, {
        type: input?.type,
        activeOnly: input?.activeOnly,
        limit: input?.limit,
      })
    }),

  // Get template by ID
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const template = await getTemplateById(ctx.db, input.id)

    if (!template || template.writerId !== ctx.user.id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found',
      })
    }

    return template
  }),

  // Get template by slug
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await getTemplateBySlug(ctx.db, ctx.user.id, input.slug)

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        })
      }

      return template
    }),

  // Get default template by type
  getDefault: protectedProcedure
    .input(z.object({ type: templateTypeSchema }))
    .query(async ({ ctx, input }) => {
      return getDefaultTemplate(ctx.db, ctx.user.id, input.type)
    }),

  // Create template
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: templateTypeSchema.optional(),
        subject: z.string().optional(),
        htmlContent: z.string().optional(),
        jsonContent: z.any().optional(),
        previewText: z.string().optional(),
        isDefault: z.boolean().optional(),
        variables: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Auto-extract variables from HTML if not provided
      let variables = input.variables
      if (!variables && input.htmlContent) {
        variables = extractTemplateVariables(input.htmlContent)
      }

      const template = await createTemplate(ctx.db, {
        ...input,
        writerId: ctx.user.id,
        variables,
      })

      return template
    }),

  // Update template
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        type: templateTypeSchema.optional(),
        subject: z.string().optional(),
        htmlContent: z.string().optional(),
        jsonContent: z.any().optional(),
        previewText: z.string().optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
        variables: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getTemplateById(ctx.db, input.id)

      if (!existing || existing.writerId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        })
      }

      // Auto-extract variables if HTML changed
      let variables = input.variables
      if (input.htmlContent && !variables) {
        variables = extractTemplateVariables(input.htmlContent)
      }

      const template = await updateTemplate(ctx.db, {
        ...input,
        variables,
      })

      return template
    }),

  // Delete template
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getTemplateById(ctx.db, input.id)

      if (!existing || existing.writerId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        })
      }

      await deleteTemplate(ctx.db, input.id)

      return { success: true }
    }),

  // Duplicate template
  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        newName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getTemplateById(ctx.db, input.id)

      if (!existing || existing.writerId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        })
      }

      const template = await duplicateTemplate(ctx.db, input.id, ctx.user.id, input.newName)

      return template
    }),

  // Preview template with variables
  preview: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        variables: z.record(z.string(), z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const template = await getTemplateById(ctx.db, input.id)

      if (!template || template.writerId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        })
      }

      if (!template.htmlContent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Template has no HTML content',
        })
      }

      // Apply default preview values for variables
      const previewVariables: Record<string, string> = {}
      const templateVars = template.variables || []

      for (const variable of templateVars) {
        const value = input.variables?.[variable]
        previewVariables[variable] = typeof value === 'string' ? value : `[${variable}]`
      }

      const renderedHtml = renderTemplate(template.htmlContent, previewVariables)

      return {
        html: renderedHtml,
        subject: template.subject,
        previewText: template.previewText,
        variables: templateVars,
      }
    }),

  // Set template as default for its type
  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getTemplateById(ctx.db, input.id)

      if (!existing || existing.writerId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        })
      }

      const template = await updateTemplate(ctx.db, {
        id: input.id,
        isDefault: true,
      })

      return template
    }),
})
