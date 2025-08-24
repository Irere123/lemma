import { env } from "cloudflare:workers";
import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "hono";
import type { User } from "better-auth";
import SuperJSON from "superjson";

import { createDb, type DB } from "@api/db";
import { createAuth } from "@api/lib/auth";

type TRPCContext = {
  user: User | undefined;
  db: DB;
};

export const createTRPCContext = async (
  _: unknown,
  c: Context
): Promise<TRPCContext> => {
  const auth = createAuth();
  const { db } = createDb(env.HYPERDRIVE.connectionString);

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  return {
    user: session?.user,
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
