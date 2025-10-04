export const baseUrl =
  (process.env.NODE_ENV as string) === "production"
    ? "https://irere.dev"
    : "http://localhost:3000";
