import { betterAuth } from "better-auth";
import { env } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { createDb } from "@api/db";

export const createAuth = () => {
  const { db } = createDb(env.HYPERDRIVE.connectionString);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;
