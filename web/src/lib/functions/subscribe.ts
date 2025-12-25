import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { subscribeToNewsletter } from '../api/newsletter'

export const subscribe = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string() }))
  .handler(async ({ data: { email } }) => {
    try {
      await subscribeToNewsletter(email)
      return { success: true }
    } catch (error) {
      throw error
    }
  })
