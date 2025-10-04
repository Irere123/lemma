import { eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { WelcomeNewsletter } from "@brain/email/emails/welcome-newsletter";
import { subscribers } from "@api/db/schema";
import { createTRPCRouter, publicProcedure } from "@api/trpc/init";
import { generateId } from "@api/lib/utils";
import { resend } from "@api/services/resend";

export const newsletterRouter = createTRPCRouter({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [sub] = await ctx.db
        .select()
        .from(subscribers)
        .where(eq(subscribers.email, input.email))
        .limit(1);

      if (sub) {
        throw new TRPCError({
          message: "Already joined the newsletter.",
          code: "CONFLICT",
        });
      }

      try {
        const [subCreated] = await ctx.db
          .insert(subscribers)
          .values({
            id: generateId(),
            email: input.email,
            token: generateId("st"),
          })
          .returning();

        await resend.emails.send({
          from: `Irere Emmanuel <welcome@${process.env.RESEND_DOMAIN}>`,
          subject: "Welcome Abroad!",
          to: subCreated?.email as string,
          react: WelcomeNewsletter({ token: subCreated?.token as string }),
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
      const sub = await ctx.db
        .select()
        .from(subscribers)
        .where(eq(subscribers.token, input.token));

      if (!sub) {
        throw new TRPCError({
          message: "Subscription not found",
          code: "NOT_FOUND",
        });
      }

      try {
        await ctx.db
          .update(subscribers)
          .set({ isUnsubscribed: true, unsubscribedAt: new Date() });
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
      const sub = await ctx.db
        .select()
        .from(subscribers)
        .where(eq(subscribers.token, input.token));

      if (!sub) {
        throw new TRPCError({
          message: "Subscription not found",
          code: "NOT_FOUND",
        });
      }

      try {
        await ctx.db
          .update(subscribers)
          .set({ confirmedAt: new Date(), isConfirmed: true });
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
