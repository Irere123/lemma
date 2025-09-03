import type { env } from "cloudflare:workers";

import type { Auth } from "@api/lib/auth";
import type { DB } from "@api/db";
import type { Scope } from "./scopes";

export type Session = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>;

export type HonoVariables = {
  session: Session;
  scopes: Scope[];
  db: DB;
};

export type AppBindings = { Variables: HonoVariables; Bindings: typeof env };
