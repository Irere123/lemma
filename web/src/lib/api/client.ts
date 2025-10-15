import axios from "axios";

// Create axios instance
export const client = axios.create({
  baseURL: `${process.env.VITE_PUBLIC_BACKEND_URL}/api/v1`,
  headers: {
    Accept: "application/json, text/plain, */*",
    Authorization: `Bearer ${process.env.BRAIN_API_KEY}`,
  },
});
