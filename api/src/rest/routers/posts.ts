import { createRoute, z } from "@hono/zod-openapi";

import { createRouter } from "@api/lib/utils";
import { documentSchema } from "@api/schemas";
import { getDocumentById } from "@api/db/queries";
import { validateResponse } from "@api/lib/validate-response";

const postsRouter = createRouter();

postsRouter.openapi(
  createRoute({
    method: "get",
    path: "/:id",
    tags: ["Posts"],
    summary: "Get post by ID",
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description:
          "Retrieve all user related blog, articles, and notes documents",
        content: {
          "application/json": {
            schema: documentSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const filters = c.req.valid("param");

    const document = await getDocumentById(db, filters.id);

    return c.json(validateResponse(document, documentSchema));
  }
);

export { postsRouter };
