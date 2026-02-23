import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { authClient } from '@/lib/auth-client'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await authClient.getSession({
    fetchOptions: {
      headers: headers,
    },
  })

  return session
})

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await authClient.getSession({
    fetchOptions: {
      headers: headers,
    },
  })

  if (!session) {
    throw new Error('Unauthorized')
  }

  return session
})
