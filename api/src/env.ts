import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.string().default("4000"),
  NODE_ENV: z.string().default("development"),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  BETTER_AUTH_SECRET: z.string().default("supersecret"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
});

export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(data: any) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const errorMessage = `error: invalid env:\n${Object.entries(
      error.flatten().fieldErrors
    )
      .map(([key, errors]) => `${key}: ${errors.join(", ")}`)
      .join("\n")}`;
    throw new Error(errorMessage);
  }

  return env;
}
