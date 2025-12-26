import { GraphQLError } from 'graphql'

import { generateId } from '@api/lib/utils'
import { storage } from '@api/lib/storage'
import type { GraphQLContext } from '../context'
import { requireAuth } from '../context'

type PreSignedUrlInput = {
  filename: string
  fileSize: number
  contentType: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

export const uploadResolvers = {
  Mutation: {
    generatePreSignedUrl: async (
      _: unknown,
      args: { input: PreSignedUrlInput },
      context: GraphQLContext
    ) => {
      requireAuth(context)

      const { session } = context
      const { filename, fileSize, contentType } = args.input

      // Validate file size
      if (fileSize > MAX_FILE_SIZE) {
        throw new GraphQLError('File size exceeds maximum allowed (10MB)', {
          extensions: { code: 'BAD_REQUEST' },
        })
      }

      // Validate content type
      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        throw new GraphQLError(
          `Invalid content type. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
          { extensions: { code: 'BAD_REQUEST' } }
        )
      }

      // Generate unique filename
      const extension = filename.split('.').pop() || 'bin'
      const uniqueFilename = `file_${generateId()}.${extension}`

      // Generate pre-signed URL
      const result = await storage.getSignedUploadUrl({
        key: uniqueFilename,
        contentType,
        expiresIn: 3600,
      })

      return {
        preSignedUrl: result.url,
        filename: uniqueFilename,
        fileSize,
        contentType,
        expiresIn: result.expiresIn,
        originalFilename: filename,
        uploadedBy: session!.user.id,
        uploadedAt: new Date().toISOString(),
      }
    },
  },
}
