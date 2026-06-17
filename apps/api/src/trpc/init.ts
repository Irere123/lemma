import { initTRPC, TRPCError } from '@trpc/server'
import type { User } from 'better-auth'
import type { Context } from 'hono'
import SuperJSON from 'superjson'

import { createDb, type DB } from '@api/db'
import type { Environment } from '@api/env'
import { env } from '@api/env-runtime'
import { createAuth } from '@api/lib/auth'
import { isProduction } from '@api/lib/constants'

type TRPCContext = {
  user: User | undefined
  db: DB
  env: Environment
}

export const createTRPCContext = async (_: unknown, c: Context): Promise<TRPCContext> => {
  const auth = createAuth()
  const { db } = createDb()

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  return {
    user: session?.user,
    db,
    env,
  }
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: SuperJSON,
  errorFormatter({ shape, error }) {
    const isInternal = error.code === 'INTERNAL_SERVER_ERROR'
    return {
      ...shape,
      message:
        isInternal && isProduction()
          ? 'An unexpected error occurred. Please try again later.'
          : shape.message,
      data: {
        ...shape.data,
        // Never expose stack traces to clients.
        stack: undefined,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.user,
    },
  })
})
