import { createRouter } from '@api/lib/utils'
import { protectedMiddleware, publicMiddleware } from '../middleware'
import { campaignsRouter } from './campaigns'
import { categoriesRouter } from './categories'
import { commentsRouter } from './comments'
import { documentsRouter } from './documents'
import { feedsRouter } from './feeds'
import { likesRouter } from './likes'
import { newsletterRouter } from './newsletter'
import { oauthRouter } from './oauth'
import { postsRouter } from './posts'
import { subscribersRouter } from './subscribers'
import { tagsRouter } from './tags'
import { uploadsRouter } from './uploads'
import { usersRouter } from './users'

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
routers.route('/categories', categoriesRouter)
routers.route('/tags', tagsRouter)
routers.route('/subscribers', subscribersRouter)
routers.route('/users', usersRouter)

export { routers }
