import axios from 'axios'

// Create axios instance
export const client = axios.create({
  baseURL: `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/v1`,
  withCredentials: true,
})
