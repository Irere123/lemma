import { createRouter } from '@api/lib/utils'

import { protectedMiddleware, publicMiddleware } from '../middleware'
import { campaignsRouter } from './campaigns'
import { commentsRouter } from './comments'
import { documentsRouter } from './documents'
import { feedsRouter } from './feeds'
import { likesRouter } from './likes'
import { newsletterRouter } from './newsletter'
import { oauthRouter } from './oauth'
import { postsRouter } from './posts'
import { uploadsRouter } from './uploads'

const routers = createRouter()

// Public routes (not authenticated)

routers.use(...publicMiddleware)

// Mount public routes first
routers.route('/oauth', oauthRouter)
routers.route('/posts', postsRouter)
routers.route('/newsletter', newsletterRouter)
routers.route('/feeds', feedsRouter)
routers.route('/comments', commentsRouter) // Has both public and protected routes (per-route middleware)
routers.route('/likes', likesRouter) // Has both public and protected routes (per-route middleware)

// Authenticated routes

routers.use(...protectedMiddleware)

routers.route('/documents', documentsRouter)
routers.route('/uploads', uploadsRouter)
routers.route('/campaigns', campaignsRouter)

export { routers }
