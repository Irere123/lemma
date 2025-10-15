import { client } from "./client";

export const subscribeToNewsletter = async (email: string) => {
  const response = await client.post(
    "/newsletter/subscribe",
    { email },
    {
      headers: {
        Authorization: `Bearer ${process.env.BRAIN_API_KEY}`,
      },
    }
  );
  return response.data;
};
