import { createYoga } from 'graphql-yoga'
import type { Context } from 'hono'

import { env } from '@api/env-runtime'
import { createGraphQLContext, type GraphQLContext } from './context'
import { schema } from './schema'
import { getSecurityPlugins } from './security'

type ServerContext = { honoContext: Context }

const isProduction = env.ENV === 'production'

export const yoga = createYoga<ServerContext, GraphQLContext>({
  // @ts-expect-error - Schema context type mismatch is expected, context is provided at runtime
  schema,
  context: async ({ honoContext }: ServerContext): Promise<GraphQLContext> => {
    return createGraphQLContext(honoContext)
  },
  graphqlEndpoint: '/graphql',
  landingPage: false,
  graphiql: isProduction ? false : { title: 'Lemma' },
  plugins: getSecurityPlugins(),
  // Batch requests disabled to prevent batching attacks
  batching: false,
  // CORS handled by Hono middleware
  cors: false,
})

export type { GraphQLContext } from './context'
export { schema } from './schema'

