import { env } from "@api/env-runtime";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { createDb } from "@api/db";

export const createAuth = () => {
  const { db } = createDb(env.DATABASE_URL);

  return betterAuth({
    basePath: "/auth",
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    trustedOrigins: [...env.ALLOWED_API_ORIGINS.split(",")],
    advanced: {
      cookiePrefix: "lemma",
      crossSubDomainCookies: {
        enabled: env.ENV !== "development",
        domain: ".irere.dev",
      },
      useSecureCookies: env.ENV !== "development",
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;
