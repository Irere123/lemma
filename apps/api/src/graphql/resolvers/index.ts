import { documentResolvers } from './documents'
import { campaignResolvers } from './campaigns'
import { commentResolvers } from './comments'
import { likeResolvers } from './likes'
import { newsletterResolvers } from './newsletter'
import { uploadResolvers } from './uploads'
import { userResolvers } from './users'
import { DateTimeScalar, JSONScalar } from '../scalars'

export const resolvers = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,

  Query: {
    ...documentResolvers.Query,
    ...campaignResolvers.Query,
    ...commentResolvers.Query,
    ...likeResolvers.Query,
    ...newsletterResolvers.Query,
    ...userResolvers.Query,
  },

  Mutation: {
    ...documentResolvers.Mutation,
    ...campaignResolvers.Mutation,
    ...commentResolvers.Mutation,
    ...likeResolvers.Mutation,
    ...newsletterResolvers.Mutation,
    ...uploadResolvers.Mutation,
  },

  // Field resolvers
  Document: documentResolvers.Document,
  Campaign: campaignResolvers.Campaign,
  Comment: commentResolvers.Comment,

  // Node interface resolver
  Node: {
    __resolveType(obj: { __typename?: string; id: string }) {
      return obj.__typename || null
    },
  },
}
