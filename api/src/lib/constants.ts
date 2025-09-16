import { env } from "cloudflare:workers";

export const BASE_URL =
  env.NODE_ENV === "development"
    ? "http://localhost:4000"
    : "https://api.irere.dev";
