import { Hono } from "hono";
import type { Context } from "./rest/types";
import { auth } from "./lib/auth";
import { routers } from "./rest/routers";

const app = new Hono<Context>();

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.route("/", routers);

export default {
  port: 4000,
  fetch: app.fetch,
};
