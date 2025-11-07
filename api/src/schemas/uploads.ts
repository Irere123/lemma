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

export const directUploadResponseSchema = z.object({
  url: z.string().openapi({
    description: "The publicly accessible URL of the uploaded file",
    example: "https://cdn.example.com/uploads/file_123.jpg",
  }),
  key: z.string().openapi({
    description: "The storage key used to identify the file",
    example: "file_01HZYZJCH1VYH927TFXW3KQV5M.jpg",
  }),
  filename: z.string().openapi({
    description: "The storage filename assigned to the uploaded file",
    example: "file_01HZYZJCH1VYH927TFXW3KQV5M.jpg",
  }),
  originalFilename: z.string().openapi({
    description: "The original filename supplied by the client",
    example: "cover.jpg",
  }),
  contentType: z.string().openapi({
    description: "The MIME type detected for the uploaded file",
    example: "image/jpeg",
  }),
  fileSize: z.number().openapi({
    description: "The size of the uploaded file in bytes",
    example: 512000,
  }),
  uploadedBy: z.string().openapi({
    description: "The identifier of the user who performed the upload",
    example: "user_123",
  }),
  uploadedAt: z.string().openapi({
    description: "ISO timestamp indicating when the upload completed",
    example: "2024-01-01T12:00:00.000Z",
  }),
});
