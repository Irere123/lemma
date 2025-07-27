import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { trpcServer } from "@hono/trpc-server";
import { routers } from "./rest/routers";
import { appRouter } from "./trpc/routers/_app";
import { createTRPCContext } from "./trpc/init";
import { createRouter } from "./lib/utils";
import { createAuth } from "./lib/auth";
import env from "@api/env-runtime";

const app = createRouter();

app.use(secureHeaders());

app.use(
  "/trpc/*",
  cors({
    origin: process.env.ALLOWED_API_ORIGINS?.split(",") ?? [],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "accept-language",
      "x-trpc-source",
      "x-user-locale",
      "x-user-timezone",
      "x-user-country",
    ],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return createAuth().handler(c.req.raw);
});

app.route("/", routers);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: createTRPCContext,
  })
);

export default {
  port: env.PORT || 4000,
  fetch: app.fetch,
};
