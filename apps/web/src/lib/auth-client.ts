import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  basePath: '/auth',
  baseURL: import.meta.env.VITE_PUBLIC_BACKEND_URL,
  fetchOptions: {
    credentials: 'include',
  },
})

export const { useSession, signIn, signOut } = authClient
