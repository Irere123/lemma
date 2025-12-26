import type { GraphQLContext } from '../context'

export const userResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, context: GraphQLContext) => {
      if (!context.isAuthenticated || !context.session) {
        return null
      }

      return context.session.user
    },
  },
}
