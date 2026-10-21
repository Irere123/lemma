import {
  type CslItem,
  detectIdentifier,
  normalizeItem,
  parseLibrary,
  ResolveError,
  resolveIdentifier,
  toBibTeX,
} from '@lemma/content/citations'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  addReferences,
  deleteReferences,
  listReferences,
  publishedDocumentsCiting,
  updateReference,
} from '@api/db/queries/references'
import { openRoom } from '@api/lib/documents/room'
import { createTRPCRouter, protectedProcedure } from '../init'

const csl = z.record(z.string(), z.unknown())

/** Re-render published posts that cite these references (their text changed). */
async function rerender(db: Parameters<typeof publishedDocumentsCiting>[0], ids: string[]) {
  for (const id of await publishedDocumentsCiting(db, ids)) {
    try {
      await (await openRoom(id)).flushNow()
    } catch (error) {
      console.error('references: re-render failed', { id, error: String(error) })
    }
  }
}

export const referencesRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx: { db, user } }) => listReferences(db, user.id)),

  /**
   * Look up a DOI, arXiv id, ISBN or URL and add it to the library (or return
   * the existing entry with the same DOI).
   */
  addByIdentifier: protectedProcedure
    .input(z.object({ input: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const identifier = detectIdentifier(input.input)
      if (!identifier) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Paste a DOI, arXiv ID, ISBN or web address',
        })
      }
      let item: CslItem
      try {
        item = await resolveIdentifier(identifier, (url, init) =>
          fetch(url, {
            ...init,
            headers: {
              'user-agent': 'Lemma (https://lemma.irere.dev; reference lookup)',
              ...(init?.headers ?? {}),
            },
            signal: AbortSignal.timeout(10_000),
          })
        )
      } catch (error) {
        const kind = error instanceof ResolveError ? error.kind : 'network'
        throw new TRPCError({
          code: kind === 'not-found' ? 'NOT_FOUND' : 'BAD_GATEWAY',
          message:
            kind === 'not-found'
              ? `Couldn't find that ${identifier.kind === 'url' ? 'page' : identifier.kind.toUpperCase()}`
              : 'The lookup service didn’t answer; try again',
        })
      }
      const { added, existing } = await addReferences(db, user.id, [item])
      return { item: added[0] ?? existing[0], duplicate: added.length === 0 }
    }),

  /** Import a BibTeX, RIS or CSL-JSON file. */
  import: protectedProcedure
    .input(z.object({ text: z.string().max(10_000_000), filename: z.string().max(300).optional() }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const parsed = parseLibrary(input.text, input.filename)
      if (parsed.items.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: parsed.warnings[0] ?? 'No references found in that file',
        })
      }
      const { added, existing } = await addReferences(db, user.id, parsed.items)
      return {
        format: parsed.format,
        added: added.length,
        duplicates: existing.length,
        warnings: parsed.warnings.slice(0, 20),
      }
    }),

  /** Add one reference typed in by hand. */
  create: protectedProcedure
    .input(z.object({ csl }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const { added, existing } = await addReferences(db, user.id, [normalizeItem(input.csl)])
      return added[0] ?? existing[0]
    }),

  update: protectedProcedure
    .input(
      z.object({ id: z.string(), csl: csl.optional(), key: z.string().min(1).max(120).optional() })
    )
    .mutation(async ({ ctx: { db, user }, input }) => {
      const updated = await updateReference(db, user.id, input.id, {
        csl: input.csl ? normalizeItem({ ...input.csl, id: input.id }) : undefined,
        key: input.key,
      }).catch((error: unknown) => {
        if (String(error).includes('UNIQUE')) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Another reference has that key' })
        }
        throw error
      })
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Reference not found' })
      await rerender(db, [updated.id])
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(1000) }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const citing = await publishedDocumentsCiting(db, input.ids)
      const deleted = await deleteReferences(db, user.id, input.ids)
      for (const id of citing) await (await openRoom(id)).flushNow()
      return { deleted }
    }),

  /** The library (or some of it) as BibTeX, keyed for Pandoc. */
  bibtex: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).max(5000).optional() }))
    .query(async ({ ctx: { db, user }, input }) => {
      const library = await listReferences(db, user.id)
      const wanted = input.ids ? new Set(input.ids) : null
      const items = library
        .filter((item) => !wanted || wanted.has(item.id))
        .map((item) => ({ ...item.csl, id: item.key }))
      return { bibtex: toBibTeX(items) }
    }),
})
