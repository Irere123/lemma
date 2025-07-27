import { createDb, type DB } from "@api/db";
import { env } from "cloudflare:workers";
import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "hono";
import type { User } from "better-auth";
import SuperJSON from "superjson";

type TRPCContext = {
  user: User | null;
  db: DB;
};

export const createTRPCContext = async (
  _: unknown,
  c: Context
): Promise<TRPCContext> => {
  const { db } = createDb(env.HYPERDRIVE.connectionString);
  return {
    user: c.env.user,
    db,
  };
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: SuperJSON,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.user,
    },
  });
});
