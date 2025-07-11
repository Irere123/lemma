import { db } from "@api/db";
import type { AuthType } from "@api/lib/auth";

export type Context = {
  Variables: {
    db: typeof db;
  };
  Bindings: AuthType;
};
