import { createRouter } from "@api/lib/utils";

import { protectedMiddleware, publicMiddleware } from "../middleware";
import { documentsRouter } from "./documents";
import { postsRouter } from "./posts";
import { newsletterRouter } from "./newsletter";
import { uploadsRouter } from "./uploads";

const routers = createRouter();

// Public routes (not authenticated)

routers.use(...publicMiddleware);

routers.route("/posts", postsRouter);
routers.route("/newsletter", newsletterRouter);

// Authenticated routes

routers.use(...protectedMiddleware);

routers.route("/documents", documentsRouter);
routers.route("/uploads", uploadsRouter);

export { routers };
