import { createRouter } from "@api/lib/utils";
import { protectedMiddleware } from "../middleware";

const routers = createRouter();

routers.use(...protectedMiddleware);

routers.get("/", (c) => {
  return c.json({ message: "Hello world" });
});

export { routers };
