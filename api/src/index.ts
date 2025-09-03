import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
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
  "*",
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

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: createTRPCContext,
  })
);

app.doc("/openapi", {
  openapi: "3.1.0",
  info: {
    version: "0.0.1",
    title: "Irere API",
    description: "Irere.DEV Blogging platform",
    contact: {
      name: "Support",
      email: "hello@irere.dev",
      url: "irere.dev",
    },
    license: {
      name: "AGPL-3.0 license",
      url: "https://github.com/irere123/brainos/blob/main/LICENSE",
    },
  },
  servers: [
    {
      url: "https://api.irere.dev",
      description: "Production API",
    },
  ],
  security: [{ token: [] }],
});

// Register security scheme
app.openAPIRegistry.registerComponent("securitySchemes", "token", {
  type: "http",
  scheme: "bearer",
  description: "Default authenticaton mechanism",
  "x-api-key-example": "IRERE.DEV API KEY",
});

app.get(
  "/",
  Scalar({ url: "/openapi", pageTitle: "Irere.DEV API", theme: "saturn" })
);

app.on(["POST", "GET"], "/auth/*", (c) => {
  return createAuth().handler(c.req.raw);
});

app.route("/v1", routers);

export default {
  port: env.PORT || 4000,
  fetch: app.fetch,
};
