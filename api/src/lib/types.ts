import type { env } from "cloudflare:workers";
import { type Scope } from "@lemma/common/scopes";

import type { Auth } from "@api/lib/auth";
import type { DB } from "@api/db";

export type Session = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>;

export type HonoVariables = {
  session: Session;
  scopes: Scope[];
  db: DB;
};

export type AppBindings = { Variables: HonoVariables; Bindings: typeof env };
