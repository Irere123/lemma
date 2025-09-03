import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { createTRPCRouter } from "../init";
import { newsletterRouter } from "./newsletter";
import { documentRouter } from "./documents";
import { apiKeysRouter } from "./api-keys";

export const appRouter = createTRPCRouter({
  newsletter: newsletterRouter,
  documents: documentRouter,
  apiKeys: apiKeysRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
