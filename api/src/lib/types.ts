import type { Environment } from '@api/env'
import { type Scope } from '@lemma/common/scopes'

import type { DB } from '@api/db'
import type { Auth } from '@api/lib/auth'

export type Session = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>

export type HonoVariables = {
  session: Session
  scopes: Scope[]
  db: DB
}

export type AppBindings = { Variables: HonoVariables; Bindings: Environment }
