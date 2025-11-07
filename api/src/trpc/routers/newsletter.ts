import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@api/trpc/init";
import { generateId } from "@api/lib/utils";
import {
  getWriterNewsletterSettings,
  upsertWriterNewsletterSettings,
} from "@api/db/queries/newsletter-settings";
import { enqueueWelcomeNewsletter } from "@api/services/email-queue";
import { newsletterSettingsSchema } from "@api/schemas/newsletter";
import {
  getSubscriberByEmail,
  getSubscriberByToken,
  upsertSubscriber,
} from "@api/db/queries/subscribers";

export const newsletterRouter = createTRPCRouter({
  getWriterNewsletterSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getWriterNewsletterSettings(ctx.db, ctx.user.id);
    return settings;
  }),
  upsertNewsletterSettings: protectedProcedure
    .input(newsletterSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const settings = await upsertWriterNewsletterSettings(ctx.db, {
        writerId: ctx.user.id,
        id: input.id,
        newsletterName: input.newsletterName,
        fromName: input.fromName,
        logoUrl: input.logoUrl || null,
        brandColor: input.brandColor || null,
        confirmationUrl: input.confirmationUrl || null,
        isActive: input.isActive,
      });

      return settings;
    }),

  /**
   * Subscribe to the newsletter
   * protected because we need to know the writerId
   * send the api key or auth cookie when calling this endpoint
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        email: z.email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriberByEmail(ctx.db, input.email);

      if (sub) {
        throw new TRPCError({
          message: "Already joined the newsletter.",
          code: "CONFLICT",
        });
      }

      try {
        const subCreated = await upsertSubscriber(ctx.db, {
          email: input.email,
          token: generateId("st"),
          writerId: ctx.user.id,
        });

        const writerSettings = await getWriterNewsletterSettings(
          ctx.db,
          ctx.user.id
        );

        if (!writerSettings) {
          throw new TRPCError({
            message: "Writer newsletter not found.",
            code: "NOT_FOUND",
          });
        }

        if (!subCreated) {
          throw new TRPCError({
            message: "Subscription not created",
            code: "INTERNAL_SERVER_ERROR",
          });
        }

        await enqueueWelcomeNewsletter({
          env: ctx.env,
          email: subCreated.email,
          writerSettings,
          token: subCreated.token,
          options: {
            delayMs: 0,
            priority: 9,
            maxAttempts: 5,
          },
        });
      } catch (error) {
        console.log(error);
        throw new TRPCError({
          message: "Something went wrong",
          code: "INTERNAL_SERVER_ERROR",
        });
      }

      return {
        success: true,
      };
    }),
  unsubscribe: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriberByToken(ctx.db, input.token);

      if (!sub) {
        throw new TRPCError({
          message: "Subscription not found",
          code: "NOT_FOUND",
        });
      }

      try {
        await upsertSubscriber(ctx.db, {
          id: sub.id,
          isUnsubscribed: true,
          email: sub.email,
          token: sub.token,
          unsubscribedAt: new Date(),
          writerId: sub.writerId as string,
        });
      } catch (error) {
        console.log(error);
        throw new TRPCError({
          message: "Something went wrong",
          code: "INTERNAL_SERVER_ERROR",
        });
      }

      return {
        success: true,
      };
    }),
  confirmation: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriberByToken(ctx.db, input.token);

      if (!sub) {
        throw new TRPCError({
          message: "Subscription not found",
          code: "NOT_FOUND",
        });
      }

      try {
        await upsertSubscriber(ctx.db, {
          id: sub.id,
          isConfirmed: true,
          confirmedAt: new Date(),
          email: sub.email,
          token: sub.token,
          writerId: sub.writerId as string,
        });
      } catch (error) {
        console.log(error);
        throw new TRPCError({
          message: "Something went wrong",
          code: "INTERNAL_SERVER_ERROR",
        });
      }

      return {
        success: true,
      };
    }),
});
