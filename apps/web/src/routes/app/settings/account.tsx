import { IconLoader2 } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { type SubmitEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient, useSession } from '@/lib/auth-client'

export const Route = createFileRoute('/app/settings/account')({
  component: RouteComponent,
})

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
})

function RouteComponent() {
  const { data: session, isPending, refetch } = useSession()
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<{
    name?: string
  }>({})

  useEffect(() => {
    if (!session?.user) {
      return
    }

    setName(session.user.name ?? '')
    setErrors({})
  }, [session?.user])

  const validate = () => {
    const parsed = profileSchema.safeParse({
      name,
    })

    if (parsed.success) {
      setErrors({})
      return true
    }

    const fieldErrors: { name?: string } = {}
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'name') {
        fieldErrors.name = issue.message
      }
    }
    setErrors(fieldErrors)
    return false
  }

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) {
      return
    }
    setIsSaving(true)

    try {
      const trimmedName = name.trim()
      const response = await authClient.updateUser({
        name: trimmedName,
      })

      if (response.error) {
        toast.error(response.error.message || 'Failed to update profile')
        return
      }

      await refetch()
      setName(trimmedName)
      setErrors({})
      toast.success('Profile updated successfully')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const fallback = name.trim().charAt(0).toUpperCase() || 'U'
  const hasChanges = !!session?.user && name !== (session.user.name ?? '')

  return (
    <section className='space-y-6'>
      <div className='space-y-2'>
        <h3 className='font-semibold text-xl tracking-tight'>Account</h3>
        <p className='text-muted-foreground text-sm'>Update your profile information.</p>
      </div>

      <div className='rounded-xl border bg-card p-6'>
        <form onSubmit={onSubmit} className='space-y-5'>
          <div className='flex items-center gap-3 rounded-lg border bg-muted/20 p-3'>
            <Avatar className='h-11 w-11'>
              <AvatarImage src={session?.user?.image ?? undefined} alt='Profile avatar' />
              <AvatarFallback>{fallback}</AvatarFallback>
            </Avatar>
            <div>
              <p className='font-medium text-sm'>{session?.user?.email ?? 'Signed in user'}</p>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='settings-name'>Name</Label>
            <Input
              id='settings-name'
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: undefined }))
                }
              }}
              autoComplete='name'
              placeholder='Your name'
              disabled={isPending || isSaving}
            />
            {errors.name && <p className='text-destructive text-xs'>{errors.name}</p>}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='settings-email'>Email</Label>
            <Input id='settings-email' value={session?.user?.email ?? ''} disabled readOnly />
          </div>

          <div className='flex justify-end'>
            <Button
              type='submit'
              disabled={isPending || isSaving || !hasChanges}
              className='min-w-32'
            >
              {isSaving && <IconLoader2 className='animate-spin' size={16} />}
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}
