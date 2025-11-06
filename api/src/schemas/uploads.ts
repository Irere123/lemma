import { z } from "@hono/zod-openapi";

export const preSignedUrlSchema = z.object({
  fileSize: z.number().openapi({
    description: "The size of the file to upload",
    example: 1000,
  }),
  contentType: z.string().openapi({
    description: "The type of the file to upload",
    example: "image/jpeg",
  }),
  filename: z.string().openapi({
    description: "The name of the file to upload",
    example: "image.jpeg",
  }),
});

export const preSignedUrlResponseSchema = z.object({
  preSignedUrl: z.string().openapi({
    description: "The pre-signed URL to upload the file",
    example: "https://example.com/upload",
  }),
  filename: z.string().openapi({
    description: "The name of the file to upload",
    example: "image.jpeg",
  }),
  fileSize: z.number().openapi({
    description: "The size of the file to upload",
    example: 1000,
  }),
  contentType: z.string().openapi({
    description: "The type of the file to upload",
    example: "image/jpeg",
  }),
  expiresIn: z.number().openapi({
    description: "The number of seconds until the pre-signed URL expires",
    example: 3600,
  }),
  originalFilename: z.string().openapi({
    description: "The original name of the file to upload",
    example: "image.jpeg",
  }),
  uploadedBy: z.string().openapi({
    description: "The user who uploaded the file",
    example: "123",
  }),
  uploadedAt: z.string().openapi({
    description: "The date and time the file was uploaded",
  }),
});

export const preSignedUrlErrorResponseSchema = z.object({
  success: z.boolean().openapi({
    description: "Whether the request was successful",
    example: true,
  }),
  error: z.string().openapi({
    description: "The error message",
    example: "File size exceeds the maximum allowed size",
  }),
});
