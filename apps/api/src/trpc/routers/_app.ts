import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

import { createTRPCRouter } from '../init'
import { apiKeysRouter } from './api-keys'
import { campaignsRouter } from './campaigns'
import { documentRouter } from './documents'
import { newsletterRouter } from './newsletter'
import { oauthApplicationsRouter } from './oauth-applications'
import { workspacesRouter } from './workspaces'

export const appRouter = createTRPCRouter({
  newsletter: newsletterRouter,
  documents: documentRouter,
  apiKeys: apiKeysRouter,
  campaigns: campaignsRouter,
  workspaces: workspacesRouter,
  oauthApplications: oauthApplicationsRouter,
})

// export type definition of API
export type AppRouter = typeof appRouter
export type RouterOutputs = inferRouterOutputs<AppRouter>
export type RouterInputs = inferRouterInputs<AppRouter>
