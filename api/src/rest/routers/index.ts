import { createRouter } from "@api/lib/utils";

import { protectedMiddleware, publicMiddleware } from "../middleware";
import { documentsRouter } from "./documents";
import { postsRouter } from "./posts";

const routers = createRouter();

// Public routes (not authenticated)

routers.use(...publicMiddleware);

routers.route("/posts", postsRouter);

// Authenticated routes

routers.use(...protectedMiddleware);

routers.route("/documents", documentsRouter);

export { routers };
