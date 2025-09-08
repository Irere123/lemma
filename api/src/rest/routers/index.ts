import { createRouter } from "@api/lib/utils";
import { protectedMiddleware } from "../middleware";
import { documentsRouter } from "./documents";

const routers = createRouter();

routers.get("/", (c) => {
  return c.json({ message: "Hello API v1" });
});

// Authenticated routes

routers.use(...protectedMiddleware);

routers.route("/documents", documentsRouter);

export { routers };
