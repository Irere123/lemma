import { Hono } from "hono";
import type { Context } from "../types";

const routers = new Hono<Context>();

routers.get("/", (c) => {
  return c.json({ message: "Hello world" });
});

export { routers };
