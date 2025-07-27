import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "@api/lib/auth";

export const withAuth: MiddlewareHandler = async (c, next) => {
  const auth = createAuth();

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set("auth", auth);
  c.set("sessionUser", session?.user);

  await next();
};
