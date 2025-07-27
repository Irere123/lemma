import type { MiddlewareHandler } from "hono";
import { createDb } from "@api/db";
import { env } from "cloudflare:workers";

/**
 * Database middleware that connects to the database and sets it on context
 */
export const withDatabase: MiddlewareHandler = async (c, next) => {
  const { db } = createDb(env.HYPERDRIVE.connectionString);

  // Set database on context
  c.set("db", db);

  await next();
};
