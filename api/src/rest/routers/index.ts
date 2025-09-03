import { createRouter } from "@api/lib/utils";
import { protectedMiddleware } from "../middleware";
import { documentsRouter } from "./documents";

const routers = createRouter();

routers.use(...protectedMiddleware);

routers.route("/documents", documentsRouter);

routers.get("/", (c) => {
  return c.json({ message: "Hello world" });
});

export { routers };
