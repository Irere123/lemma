import KSUID from "ksuid";
import { Hono } from "hono";
import type { AppBindings } from "@api/lib/types";

export const generateId = (prefix?: string) => {
  if (!prefix) {
    return KSUID.randomSync().string;
  } else {
    return `${prefix}_${KSUID.randomSync().string}`;
  }
};

export function createRouter() {
  return new Hono<AppBindings>({
    strict: false,
  });
}
