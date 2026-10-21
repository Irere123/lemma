import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { CLIENT_ID_PATTERN, getUserDocumentById } from '@api/db/queries/documents'
import { getBacklinks, getOrCreateDailyNote, getUnlinkedMentions } from '@api/db/queries/notes'
import { createTRPCRouter, protectedProcedure } from '../init'

export const notesRouter = createTRPCRouter({
  /** "Linked from": documents linking here, plus mentions of the title not linked yet. */
  backlinks: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx: { db, user }, input }) => {
      const doc = await getUserDocumentById(db, input.id, user.id)
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      const [links, mentions] = await Promise.all([
        getBacklinks(db, doc.id, user.id),
        getUnlinkedMentions(db, doc, user.id),
      ])
      return { links, mentions }
    }),

  /** Today's note, by the writer's local date. */
  daily: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        title: z.string().min(1).max(200),
        id: z.string().regex(CLIENT_ID_PATTERN).optional(),
      })
    )
    .mutation(async ({ ctx: { db, user }, input }) => {
      const note = await getOrCreateDailyNote(db, user.id, input)
      if (!note) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
      return note
    }),
})
