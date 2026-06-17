import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  basePath: '/auth',
  baseURL: import.meta.env.VITE_PUBLIC_BACKEND_URL,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [
    emailOTPClient(),
    // Mirror the API's user.additionalFields so session.user is typed with the
    // public-profile fields and authClient.updateUser accepts them. (socialLinks
    // is JSON and handled via the tRPC `profile` router instead.)
    inferAdditionalFields({
      user: {
        username: { type: 'string' },
        bio: { type: 'string' },
        website: { type: 'string' },
        location: { type: 'string' },
      },
    }),
  ],
})

export const { useSession, signIn, signOut } = authClient
