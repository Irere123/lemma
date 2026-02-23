import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

export const authClient = createAuthClient({
  basePath: '/auth',
  baseURL: import.meta.env.VITE_PUBLIC_BACKEND_URL,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [emailOTPClient(), tanstackStartCookies()],
})

export const { useSession, signIn, signOut } = authClient
