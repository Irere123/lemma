import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

import { createTRPCRouter } from '../init'
import { apiKeysRouter } from './api-keys'
import { booksRouter } from './books'
import { campaignsRouter } from './campaigns'
import { commentsRouter } from './comments'
import { documentRouter } from './documents'
import { followsRouter } from './follows'
import { likesRouter } from './likes'
import { newsletterRouter } from './newsletter'
import { notesRouter } from './notes'
import { oauthApplicationsRouter } from './oauth-applications'
import { profileRouter } from './profile'
import { referencesRouter } from './references'
import { workspacesRouter } from './workspaces'

export const appRouter = createTRPCRouter({
  newsletter: newsletterRouter,
  documents: documentRouter,
  comments: commentsRouter,
  likes: likesRouter,
  apiKeys: apiKeysRouter,
  campaigns: campaignsRouter,
  workspaces: workspacesRouter,
  oauthApplications: oauthApplicationsRouter,
  profile: profileRouter,
  follows: followsRouter,
  books: booksRouter,
  notes: notesRouter,
  references: referencesRouter,
})

export type AppRouter = typeof appRouter
export type RouterOutputs = inferRouterOutputs<AppRouter>
export type RouterInputs = inferRouterInputs<AppRouter>
