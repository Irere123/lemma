import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";
import {
  getPublishedArticles,
  getPublishedArticleBySlug,
} from "@api/db/queries";

export const postsRouter = createTRPCRouter({
  getPublishedArticles: publicProcedure.query(async ({ ctx }) => {
    return await getPublishedArticles(ctx.db);
  }),

  getArticleBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      return await getPublishedArticleBySlug(ctx.db, input.slug);
    }),
});
