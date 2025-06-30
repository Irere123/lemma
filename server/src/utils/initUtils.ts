import "dotenv/config";

export const checkEnvVars = () => {
  if (!process.env.DATABASE_URL) {
    console.error(`DATABASE_URL is not set`);
    process.exit(1);
  }

  if (!process.env.REDIS_URL) {
    console.error(`REDIS_URL is not set`);
    process.exit(1);
  }
};
