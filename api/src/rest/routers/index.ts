import { createRouter } from "@api/lib/utils";

const routers = createRouter();

routers.get("/", (c) => {
  return c.json({ message: "Hello world" });
});

export { routers };
