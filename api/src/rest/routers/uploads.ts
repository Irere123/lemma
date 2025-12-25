import { createRoute, z } from '@hono/zod-openapi'

import { storage } from '@api/lib/storage'
import { createRouter, generateId } from '@api/lib/utils'
import {
  directUploadResponseSchema,
  preSignedUrlErrorResponseSchema,
  preSignedUrlResponseSchema,
  preSignedUrlSchema,
} from '@api/schemas'
import { validateResponse } from '@api/lib/validate-response'
import { getExtensionFromMimeType, isValidImageType } from '@api/utils/uploads'

const uploadsRouter = createRouter()

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

uploadsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['Uploads'],
    summary: 'Upload a file directly to Cloudflare R2',
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.any().openapi({
                description: 'The file payload to upload',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'File uploaded successfully',
        content: {
          'application/json': {
            schema: directUploadResponseSchema,
          },
        },
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: preSignedUrlErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: preSignedUrlErrorResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const session = c.get('session')

    const form = await c.req.parseBody()
    const formFile = form['file']

    const file = Array.isArray(formFile) ? formFile[0] : formFile

    if (!(file instanceof File)) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'A file must be provided',
          },
          preSignedUrlErrorResponseSchema
        ),
        400
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'File size exceeds the maximum allowed size',
          },
          preSignedUrlErrorResponseSchema
        ),
        400
      )
    }

    const contentType = file.type || 'application/octet-stream'

    if (!isValidImageType(contentType)) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'Invalid file type',
          },
          preSignedUrlErrorResponseSchema
        ),
        400
      )
    }

    const extension = getExtensionFromMimeType(contentType)
    const originalFilename = file.name || `upload${extension}`
    const key = `${generateId('file')}${extension}`
    const uploadedAt = new Date().toISOString()
    const uploadedBy = session.user.id

    try {
      const uploadResult = await storage.upload(key, file, {
        contentType,
      })

      return c.json(
        validateResponse(
          {
            url: uploadResult.url,
            key,
            filename: key,
            originalFilename,
            contentType,
            fileSize: file.size,
            uploadedBy,
            uploadedAt,
          },
          directUploadResponseSchema
        )
      )
    } catch (error) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'Failed to upload file',
          },
          preSignedUrlErrorResponseSchema
        ),
        500
      )
    }
  }
)

uploadsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/pre-signed-url',
    tags: ['Uploads'],
    summary: 'Generate a pre-signed URL to upload a file',
    request: {
      body: {
        content: {
          'application/json': {
            schema: preSignedUrlSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Pre-signed URL generated successfully',
        content: {
          'application/json': {
            schema: preSignedUrlResponseSchema,
          },
        },
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: preSignedUrlErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: preSignedUrlErrorResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const session = c.get('session')
    const { fileSize, contentType, filename } = c.req.valid('json')

    if (fileSize > MAX_FILE_SIZE) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'File size exceeds the maximum allowed size',
          },
          preSignedUrlErrorResponseSchema
        ),
        400
      )
    }

    if (!isValidImageType(contentType)) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'Invalid file type',
          },
          preSignedUrlErrorResponseSchema
        ),
        400
      )
    }

    const key = generateId('file')
    const uploadedAt = new Date().toISOString()
    const uploadedBy = session.user.id

    try {
      const signedUpload = await storage.getSignedUploadUrl({
        key,
        contentType,
        expiresIn: 3600,
      })

      return c.json(
        validateResponse(
          {
            preSignedUrl: signedUpload.url,
            filename: key,
            fileSize,
            contentType,
            expiresIn: signedUpload.expiresIn,
            originalFilename: filename,
            uploadedBy,
            uploadedAt,
          },
          preSignedUrlResponseSchema
        )
      )
    } catch (error) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'Failed to generate pre-signed URL',
          },
          preSignedUrlErrorResponseSchema
        ),
        500
      )
    }
  }
)

export { uploadsRouter }
