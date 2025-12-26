import { createYoga } from 'graphql-yoga'
import type { Context } from 'hono'

import { schema } from './schema'
import { createGraphQLContext, type GraphQLContext } from './context'

type ServerContext = { honoContext: Context }

export const yoga = createYoga<ServerContext, GraphQLContext>({
  // @ts-expect-error - Schema context type mismatch is expected, context is provided at runtime
  schema,
  context: async ({ honoContext }: ServerContext): Promise<GraphQLContext> => {
    return createGraphQLContext(honoContext)
  },
  graphqlEndpoint: '/graphql',
  landingPage: false,
  graphiql: {
    title: 'Lemma GraphQL API',
  },
})

export { schema } from './schema'
export type { GraphQLContext } from './context'
