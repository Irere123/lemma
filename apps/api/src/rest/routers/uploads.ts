import { createRoute, z } from '@hono/zod-openapi'

import { env } from '@api/env-runtime'
import { storage } from '@api/lib/storage'
import { createRouter, generateId } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import {
  deleteUploadResponseSchema,
  deleteUploadSchema,
  directUploadResponseSchema,
  preSignedUrlErrorResponseSchema,
  preSignedUrlResponseSchema,
  preSignedUrlSchema,
} from '@api/schemas'
import { getExtensionFromMimeType, isValidImageType } from '@api/utils/uploads'

const uploadsRouter = createRouter()

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const resolveDeleteKey = ({ key, fileUrl }: { key?: string; fileUrl?: string }): null | string => {
  if (key) {
    const normalized = key.replace(/^\/+/, '').trim()
    return normalized || null
  }

  if (!fileUrl) return null

  try {
    const fileUrlObject = new URL(fileUrl)
    const storageBaseUrlObject = new URL(env.R2_STORAGE_BASE_URL)

    if (fileUrlObject.host !== storageBaseUrlObject.host) {
      return null
    }

    const filePath = fileUrlObject.pathname.replace(/^\/+/, '')
    if (!filePath) return null

    const basePath = storageBaseUrlObject.pathname.replace(/^\/+|\/+$/g, '')
    if (!basePath) return filePath

    if (filePath === basePath) return null
    if (!filePath.startsWith(`${basePath}/`)) return null

    const relativePath = filePath.slice(basePath.length).replace(/^\/+/, '')
    return relativePath || null
  } catch (_error) {
    return null
  }
}

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
    const formFile = form.file

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
    path: '/delete',
    tags: ['Uploads'],
    summary: 'Delete an uploaded file',
    request: {
      body: {
        content: {
          'application/json': {
            schema: deleteUploadSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'File deleted successfully',
        content: {
          'application/json': {
            schema: deleteUploadResponseSchema,
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
    const { key, fileUrl } = c.req.valid('json')
    const resolvedKey = resolveDeleteKey({ key, fileUrl })

    if (!resolvedKey) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'Invalid key or file URL',
          },
          preSignedUrlErrorResponseSchema
        ),
        400
      )
    }

    try {
      await storage.delete(resolvedKey)

      return c.json(
        validateResponse(
          {
            success: true,
            key: resolvedKey,
          },
          deleteUploadResponseSchema
        )
      )
    } catch (_error) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: 'Failed to delete file',
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
