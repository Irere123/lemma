import { createRoute, z } from "@hono/zod-openapi";

import { createRouter } from "@api/lib/utils";
import { documentSchema, documentsResponseSchema } from "@api/schemas";
import {
  getAdminPublishedArticles,
  getDocumentById,
  getDocumentBySlug,
} from "@api/db/queries";
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
        description: "Retrieve post by ID",
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

postsRouter.openapi(
  createRoute({
    method: "get",
    path: "/slug/:slug",
    tags: ["Posts"],
    summary: "Get post by slug",
    request: {
      params: z.object({
        slug: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Retrieve post by slug",
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
    const { slug } = c.req.valid("param");
    const document = await getDocumentBySlug(db, slug);
    return c.json(validateResponse(document, documentSchema));
  }
);

postsRouter.openapi(
  createRoute({
    method: "get",
    path: "/admin/articles",
    tags: ["Admin"],
    summary: "Retrieve all admin (irere) published articles",
    responses: {
      200: {
        description: "Retrieve all admin (irere) published articles",
        content: {
          "application/json": {
            schema: documentsResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const articles = await getAdminPublishedArticles(db);

    return c.json(
      validateResponse(
        { nextCursor: null, data: articles },
        documentsResponseSchema
      )
    );
  }
);

export { postsRouter };
