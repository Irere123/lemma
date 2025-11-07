import { z } from "zod";

const envSchema = z.object({
  BRAIN_API_KEY: z.string(),
});

const clientEnvSchema = z.object({
  VITE_PUBLIC_BACKEND_URL: z.url(),
  VITE_PUBLIC_APP_URL: z.url(),
});

export const serverEnv = envSchema.parse(process.env);

export const clientEnv = clientEnvSchema.parse(import.meta.env);
