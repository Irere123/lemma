import { createRoute, z } from "@hono/zod-openapi";
import { env } from "cloudflare:workers";

import { createRouter, generateId } from "@api/lib/utils";
import {
  getSubscriberByEmail,
  getSubscriberByToken,
  upsertSubscriber,
} from "@api/db/queries/subscribers";
import { withAuth } from "@api/rest/middleware/auth";
import { enqueueWelcomeNewsletter } from "@api/services/email-queue";
import { getWriterNewsletterSettings } from "@api/db/queries/newsletter-settings";

const newsletterRouter = createRouter();

// Subscribe
// Protected
// Send the api key or auth cookie when calling this endpoint
newsletterRouter.openapi(
  createRoute({
    method: "post",
    path: "/subscribe",
    tags: ["Newsletter"],
    summary: "Subscribe to newsletter (protected)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.email(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Subscription successful",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
      },
      409: { description: "Already subscribed" },
      404: { description: "Writer newsletter settings not found" },
      500: { description: "Internal error" },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get("db");
    const session = c.get("session");
    const input = c.req.valid("json") as { email: string };

    const existing = await getSubscriberByEmail(db, input.email);

    if (existing) {
      return c.json({ error: "Already joined the newsletter." }, 409);
    }

    try {
      const token = generateId("st");
      const writerSettings = await getWriterNewsletterSettings(
        db,
        session.user.id
      );

      if (!writerSettings) {
        return c.json({ error: "Writer newsletter settings not found" }, 404);
      }

      await upsertSubscriber(db, {
        email: input.email,
        token,
        writerId: session.user.id,
      });

      await enqueueWelcomeNewsletter({
        env,
        email: input.email,
        writerSettings,
        token,
        options: {
          delayMs: 0,
          priority: 9,
          maxAttempts: 5,
        },
      });

      return c.json({ success: true });
    } catch (error) {
      console.log(error);
      return c.json({ error: "Something went wrong" }, 500);
    }
  }
);

// Unsubscribe
newsletterRouter.openapi(
  createRoute({
    method: "post",
    path: "/unsubscribe",
    tags: ["Newsletter"],
    summary: "Unsubscribe from newsletter",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ token: z.string() }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Unsubscribed",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
      },
      404: { description: "Subscription not found" },
      500: { description: "Internal error" },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const input = c.req.valid("json") as { token: string };

    const sub = await getSubscriberByToken(db, input.token);
    if (!sub) {
      return c.json({ error: "Subscription not found" }, 404);
    }

    try {
      await upsertSubscriber(db, {
        id: sub.id,
        isUnsubscribed: true,
        email: sub.email,
        token: sub.token,
        writerId: sub.writerId,
      });

      return c.json({ success: true });
    } catch (error) {
      console.log(error);
      return c.json({ error: "Something went wrong" }, 500);
    }
  }
);

// Confirm subscription
newsletterRouter.openapi(
  createRoute({
    method: "post",
    path: "/confirmation",
    tags: ["Newsletter"],
    summary: "Confirm subscription",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ token: z.string() }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Confirmed",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
      },
      404: { description: "Subscription not found" },
      500: { description: "Internal error" },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const input = c.req.valid("json") as { token: string };

    const sub = await getSubscriberByToken(db, input.token);
    if (!sub) {
      return c.json({ error: "Subscription not found" }, 404);
    }

    try {
      await upsertSubscriber(db, {
        id: sub.id,
        isConfirmed: true,
        confirmedAt: new Date(),
        email: sub.email,
        token: sub.token,
        writerId: sub.writerId,
      });

      return c.json({ success: true });
    } catch (error) {
      console.log(error);
      return c.json({ error: "Something went wrong" }, 500);
    }
  }
);

export { newsletterRouter };
