import { createRoute, z } from "@hono/zod-openapi";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createRouter, generateId } from "@api/lib/utils";
import { subscribers } from "@api/db/schema";
import { resend } from "@api/services/resend";
import {
  getSubscriberByEmail,
  getSubscriberByToken,
} from "@api/db/queries/subscribers";

const newsletterRouter = createRouter();

// Subscribe
newsletterRouter.openapi(
  createRoute({
    method: "post",
    path: "/subscribe",
    tags: ["Newsletter"],
    summary: "Subscribe to newsletter",
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
      500: { description: "Internal error" },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const input = c.req.valid("json") as { email: string };

    const existing = await getSubscriberByEmail(db, input.email);
    if (existing) {
      return c.json({ error: "Already joined the newsletter." }, 409);
    }

    try {
      const token = generateId("st");
      await db
        .insert(subscribers)
        .values({ id: generateId(), email: input.email, token });

      const { WelcomeNewsletter } = await import(
        "@brain/email/emails/welcome-newsletter"
      );

      resend.emails.send({
        from: `Irere Emmanuel <welcome@${env.RESEND_DOMAIN}>`,
        subject: "Welcome Abroad!",
        to: input.email,
        react: WelcomeNewsletter({ token }),
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
      await db
        .update(subscribers)
        .set({ isUnsubscribed: true, unsubscribedAt: new Date() })
        .where(eq(subscribers.token, input.token));

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
      await db
        .update(subscribers)
        .set({ isConfirmed: true, confirmedAt: new Date() })
        .where(eq(subscribers.token, input.token));

      return c.json({ success: true });
    } catch (error) {
      console.log(error);
      return c.json({ error: "Something went wrong" }, 500);
    }
  }
);

export { newsletterRouter };
