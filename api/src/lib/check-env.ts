export const checkEnvVars = () => {
  if (!process.env.DATABASE_URL) {
    console.error(`DATABASE_URL is not set`);
    process.exit(1);
  }

  if (!process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL) {
    console.error(`BETTER_AUTH_SECRET or BETTER_AUTH_URL is not set`);
    process.exit(1);
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_DOMAIN) {
    console.error(`RESEND_API_KEY or RESEND_DOMAIN is not set`);
    process.exit(1);
  }

  if (!process.env.GITHUB_CLIENT_SECRET || !process.env.GITHUB_CLIENT_ID) {
    console.error(`GITHUB_CLIENT_SECRET or GITHUB_CLIENT_ID is not set`);
    process.exit(1);
  }
};
