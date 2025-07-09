import { db } from "@/db";
import type { AuthType } from "@/lib/auth";

export type Context = {
  Variables: {
    db: typeof db;
  };
  Bindings: AuthType;
};
