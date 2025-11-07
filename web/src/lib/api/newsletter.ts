import { client } from "./client";
import { serverEnv } from "@/lib/env-runtime";

export const subscribeToNewsletter = async (email: string) => {
  const response = await client.post(
    "/newsletter/subscribe",
    { email },
    {
      headers: {
        Authorization: `Bearer ${serverEnv.BRAIN_API_KEY}`,
      },
    }
  );
  return response.data;
};
