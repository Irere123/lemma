import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";

import { createRouter } from "@api/lib/utils";
import {
  documentsFilters,
  documentsResponseSchema,
  upsertDocumentResponseSchema,
  upsertDocumentSchema,
  sendNewsletterSchema,
} from "@api/schemas";
import { withRequiredScope } from "@api/rest/middleware";
import {
  getUserDocuments,
  upsertDocument,
  getDocumentById,
} from "@api/db/queries";
import { getConfirmedSubscribers } from "@api/db/queries/subscribers";
import { enqueueDocumentNewsletter } from "@api/services/email-queue";
import { validateResponse } from "@api/lib/validate-response";
import { env } from "cloudflare:workers";

const documentsRouter = createRouter();

documentsRouter.openapi(
  createRoute({
    method: "get",
    tags: ["Documents"],
    path: "/",
    summary: "List all user documents",
    request: {
      query: documentsFilters,
    },
    responses: {
      200: {
        description:
          "Retrieve all user related blog, articles, and notes documents",
        content: {
          "application/json": {
            schema: documentsResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("documents.read")],
  }),
  async (c) => {
    const db = c.get("db");
    const session = c.get("session");
    const filters = c.req.valid("query");

    const userDocuments = await getUserDocuments(db, {
      ...filters,
      userId: session.user.id,
    });

    // Check if there are more results
    const hasMore = userDocuments.length > filters.limit;
    const results = hasMore
      ? userDocuments.slice(0, filters.limit)
      : userDocuments;
    const nextCursor = hasMore
      ? (results.at(-1)?.createdAt?.toISOString() ?? null)
      : null;

    return c.json(
      validateResponse({ nextCursor, data: results }, documentsResponseSchema)
    );
  }
);

documentsRouter.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Documents"],
    summary: "Create/Update a document",
    request: {
      body: {
        content: {
          "application/json": {
            schema: upsertDocumentSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Created/Updated document",
        content: {
          "application/json": {
            schema: upsertDocumentResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("documents.write")],
  }),
  async (c) => {
    const db = c.get("db");
    const session = c.get("session");
    const input = c.req.valid("json");

    const result = await upsertDocument(db, input, session.user.id);

    return c.json(validateResponse(result, upsertDocumentResponseSchema));
  }
);

documentsRouter.openapi(
  createRoute({
    method: "post",
    path: "/send-newsletter",
    tags: ["Documents"],
    summary: "Send document as newsletter to subscribers",
    request: {
      body: {
        content: {
          "application/json": {
            schema: sendNewsletterSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Newsletter sending initiated",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              count: z.number(),
              scheduledFor: z.date().nullable().optional(),
              jobIds: z.array(z.string()).optional(),
            }),
          },
        },
      },
      404: {
        description: "Document not found",
      },
      403: {
        description: "Forbidden - not authorized",
      },
    },
    middleware: [withRequiredScope("documents.write")],
  }),
  async (c) => {
    const db = c.get("db");
    const session = c.get("session");
    const input = c.req.valid("json");

    const { documentId, sendImmediately } = input;

    // Get the document
    const document = await getDocumentById(db, documentId);

    if (!document) {
      return c.json({ error: "Document not found" }, 404);
    }

    // Check if user owns the document
    if (document.userId !== session.user.id) {
      return c.json(
        { error: "You don't have permission to send this document" },
        403
      );
    }

    // Get confirmed subscribers
    const subscribers = await getConfirmedSubscribers(db);

    if (subscribers.length === 0) {
      return c.json({
        success: true,
        message: "No confirmed subscribers found",
        count: 0,
      });
    }

    // Prepare recipients
    const recipients = subscribers.map((sub) => ({
      email: sub.email,
      unsubscribeToken: sub.token,
    }));

    // Calculate delay based on scheduled date
    let delayMs = 0;
    if (!sendImmediately && document.scheduledDate) {
      const now = new Date();
      const scheduledTime = new Date(document.scheduledDate);
      delayMs = Math.max(0, scheduledTime.getTime() - now.getTime());
    }

    // Enqueue emails with optional delay
    const emailResults = await enqueueDocumentNewsletter(
      env,
      {
        id: document.id,
        title: document.title,
        subtitle: document.subtitle,
        markdown: document.markdown,
        bannerImage: document.bannerImage,
        publishedDate: document.publishedDate,
      },
      recipients,
      {
        delayMs,
        priority: sendImmediately ? 9 : 5,
      }
    );

    return c.json({
      success: true,
      message:
        delayMs > 0
          ? `Scheduled ${emailResults.length} emails for ${document.scheduledDate}`
          : `Enqueued ${emailResults.length} emails for immediate delivery`,
      count: emailResults.length,
      scheduledFor: document.scheduledDate,
      jobIds: emailResults.map((r) => r.jobId),
    });
  }
);

export { documentsRouter };
