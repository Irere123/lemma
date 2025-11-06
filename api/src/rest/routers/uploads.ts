import { createRoute, z } from "@hono/zod-openapi";

import { storage } from "@api/lib/storage";
import { createRouter, generateId } from "@api/lib/utils";
import {
  preSignedUrlErrorResponseSchema,
  preSignedUrlResponseSchema,
  preSignedUrlSchema,
} from "@api/schemas";
import { validateResponse } from "@api/lib/validate-response";
import { isValidImageType } from "@api/utils/uploads";

const uploadsRouter = createRouter();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

uploadsRouter.openapi(
  createRoute({
    method: "post",
    path: "/pre-signed-url",
    tags: ["Uploads"],
    summary: "Generate a pre-signed URL to upload a file",
    request: {
      body: {
        content: {
          "application/json": {
            schema: preSignedUrlSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Pre-signed URL generated successfully",
        content: {
          "application/json": {
            schema: preSignedUrlResponseSchema,
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: preSignedUrlErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: preSignedUrlErrorResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const session = c.get("session");
    const { fileSize, contentType, filename } = c.req.valid("json");

    if (fileSize > MAX_FILE_SIZE) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: "File size exceeds the maximum allowed size",
          },
          preSignedUrlErrorResponseSchema
        )
      );
    }

    if (!isValidImageType(contentType)) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: "Invalid file type",
          },
          preSignedUrlErrorResponseSchema
        )
      );
    }

    const key = generateId("file");
    const uploadedAt = new Date().toISOString();
    const uploadedBy = session.user.id;

    try {
      const res = await storage.uploadFileSigned(key, {
        filename,
        contentType,
        uploadedBy,
        uploadedAt,
      });

      return c.json(
        validateResponse(
          {
            preSignedUrl: res.url,
            filename,
            fileSize,
            contentType,
            expiresIn: 3600,
            originalFilename: filename,
            uploadedBy,
            uploadedAt,
          },
          preSignedUrlResponseSchema
        )
      );
    } catch (error) {
      return c.json(
        validateResponse(
          {
            success: false,
            error: "Failed to upload file",
          },
          preSignedUrlErrorResponseSchema
        ),
        500
      );
    }
  }
);

export { uploadsRouter };
