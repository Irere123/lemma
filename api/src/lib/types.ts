import type { env } from "cloudflare:workers";
import type { Auth } from "@api/lib/auth";

export type SessionUser = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>["user"];

export type HonoVariables = {
  auth: Auth;
  sessionUser?: SessionUser;
};

export type AppBindings = { Variables: HonoVariables; Bindings: typeof env };
