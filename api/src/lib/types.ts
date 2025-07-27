import type { env } from "cloudflare:workers";
import type { Auth } from "@api/lib/auth";
import type { DB } from "@api/db";

export type SessionUser = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>["user"];

export type HonoVariables = {
  auth: Auth;
  sessionUser?: SessionUser;
  db: DB;
};

export type AppBindings = { Variables: HonoVariables; Bindings: typeof env };
