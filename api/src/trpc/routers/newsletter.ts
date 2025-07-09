import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const newsletterRouter = createTRPCRouter({
  subscribe: publicProcedure.query(() => {
    return "Subscribed";
  }),
});
