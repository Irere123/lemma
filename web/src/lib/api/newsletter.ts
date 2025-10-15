import { client } from "./client";

export const subscribeToNewsletter = async (email: string) => {
  const response = await client.post("/newsletter/subscribe", { email });
  return response.data;
};
