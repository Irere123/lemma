import { betterAuth } from "better-auth";
import { env } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { createDb } from "@api/db";

export const createAuth = () => {
  const { db } = createDb(env.HYPERDRIVE.connectionString);

  return betterAuth({
    basePath: "/auth",
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    trustedOrigins: [...env.ALLOWED_API_ORIGINS.split(",")],
    advanced: {
      cookiePrefix: "brain",
      crossSubDomainCookies: {
        enabled: env.NODE_ENV !== "development",
        domain: ".irere.dev",
      },
      useSecureCookies: env.NODE_ENV !== "development",
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
