import { createRoute } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import { getUserById } from '@api/db/queries'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { withRequiredScope } from '@api/rest/middleware'
import { errorResponses, userProfileSchema } from '@api/schemas'

const usersRouter = createRouter()

// Get the authenticated user's profile
usersRouter.openapi(
  createRoute({
    method: 'get',
    path: '/me',
    tags: ['Users'],
    summary: 'Get the authenticated user profile',
    security: [{ token: [] }],
    responses: {
      200: {
        description: 'The authenticated user profile',
        content: { 'application/json': { schema: userProfileSchema } },
      },
      ...errorResponses(401, 403, 404, 429),
    },
    middleware: [withRequiredScope('users.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')

    const user = await getUserById(db, session.user.id)

    if (!user) {
      throw new HTTPException(404, { message: 'User not found' })
    }

    return c.json(validateResponse(user, userProfileSchema))
  }
)

export { usersRouter }
