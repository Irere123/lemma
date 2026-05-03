import { createYoga } from 'graphql-yoga'
import type { Context } from 'hono'

import { isProduction } from '@api/lib/constants'
import { createGraphQLContext, type GraphQLContext } from './context'
import { schema } from './schema'
import { getSecurityPlugins } from './security'

type ServerContext = { honoContext: Context }

export function createYogaServer() {
  return createYoga<ServerContext, GraphQLContext>({
    // @ts-expect-error - Schema context type mismatch is expected, context is provided at runtime
    schema,
    context: async ({ honoContext }: ServerContext): Promise<GraphQLContext> => {
      return createGraphQLContext(honoContext)
    },
    graphqlEndpoint: '/graphql',
    landingPage: false,
    graphiql: isProduction() ? false : { title: 'Lemma' },
    plugins: getSecurityPlugins(),
    // Batch requests disabled to prevent batching attacks
    batching: false,
    // CORS handled by Hono middleware
    cors: false,
  })
}

export type { GraphQLContext } from './context'
export { schema } from './schema'
