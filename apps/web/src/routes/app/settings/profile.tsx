import { IconCheck, IconLoader2, IconX } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { authClient, useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/settings/profile')({
  component: RouteComponent,
})

const USERNAME_RE = /^[a-z0-9_-]{3,30}$/

type SocialState = { twitter: string; github: string; linkedin: string; website: string }

function RouteComponent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { refetch: refetchSession } = useSession()

  const meQueryOptions = trpc.profile.me.queryOptions()
  const { data: me, isLoading } = useQuery(meQueryOptions)

  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [location, setLocation] = useState('')
  const [social, setSocial] = useState<SocialState>({
    twitter: '',
    github: '',
    linkedin: '',
    website: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!me) return
    setUsername(me.username ?? '')
    setBio(me.bio ?? '')
    setWebsite(me.website ?? '')
    setLocation(me.location ?? '')
    setSocial({
      twitter: me.socialLinks?.twitter ?? '',
      github: me.socialLinks?.github ?? '',
      linkedin: me.socialLinks?.linkedin ?? '',
      website: me.socialLinks?.website ?? '',
    })
  }, [me])

  // Debounced availability check — only when the handle changed and is valid.
  const debouncedUsername = useDebouncedValue(username, 400)
  const usernameChanged = !!me && debouncedUsername !== (me.username ?? '')
  const usernameValid = USERNAME_RE.test(debouncedUsername)
  const { data: availability, isFetching: checkingUsername } = useQuery(
    trpc.profile.checkUsername.queryOptions(
      { username: debouncedUsername },
      { enabled: usernameChanged && usernameValid }
    )
  )

  const updateSocialLinks = useMutation(trpc.profile.updateSocialLinks.mutationOptions())

  const formatError =
    username.length > 0 && !USERNAME_RE.test(username)
      ? 'Use 3–30 lowercase letters, numbers, hyphens, or underscores.'
      : null
  const isTaken = usernameChanged && usernameValid && availability?.available === false

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (formatError || isTaken) return
    setIsSaving(true)
    try {
      const result = await authClient.updateUser({
        username: username.trim(),
        bio: bio.trim(),
        website: website.trim(),
        location: location.trim(),
      })
      if (result.error) {
        toast.error(result.error.message || 'Could not save profile')
        return
      }

      await updateSocialLinks.mutateAsync({
        socialLinks: {
          twitter: social.twitter.trim() || undefined,
          github: social.github.trim() || undefined,
          linkedin: social.linkedin.trim() || undefined,
          website: social.website.trim() || undefined,
        },
      })

      await Promise.all([
        refetchSession(),
        queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey }),
      ])
      toast.success('Profile updated')
    } catch {
      toast.error('Could not save profile. The handle may already be taken.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className='space-y-6'>
      <div className='space-y-2'>
        <h3 className='font-semibold text-xl tracking-tight'>Public profile</h3>
        <p className='text-muted-foreground text-sm'>
          This information appears on your public profile at /u/your-handle.
        </p>
      </div>

      <form onSubmit={onSubmit} className='rounded-xl border bg-card p-6'>
        <fieldset disabled={isLoading || isSaving} className='space-y-5'>
          <div className='space-y-2'>
            <Label htmlFor='profile-username'>Handle</Label>
            <Input
              id='profile-username'
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder='your-handle'
              aria-invalid={!!formatError || isTaken}
            />
            <p className='flex items-center gap-1.5 text-xs'>
              {checkingUsername && usernameChanged ? (
                <span className='flex items-center gap-1 text-muted-foreground'>
                  <IconLoader2 className='size-3 animate-spin' /> Checking…
                </span>
              ) : formatError ? (
                <span className='text-destructive'>{formatError}</span>
              ) : isTaken ? (
                <span className='flex items-center gap-1 text-destructive'>
                  <IconX className='size-3' /> That handle is taken.
                </span>
              ) : usernameChanged && usernameValid && availability?.available ? (
                <span className='flex items-center gap-1 text-success'>
                  <IconCheck className='size-3' /> Available
                </span>
              ) : (
                <span className='text-muted-foreground'>
                  lemma.irere.dev/u/{username || 'your-handle'}
                </span>
              )}
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='profile-bio'>Bio</Label>
            <textarea
              id='profile-bio'
              value={bio}
              maxLength={280}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder='A short line about you and what you write.'
              className={cn(
                'w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs/5 outline-none placeholder:text-muted-foreground/72 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24'
              )}
            />
            <p className='text-right text-muted-foreground text-xs'>{bio.length}/280</p>
          </div>

          <div className='grid gap-5 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='profile-website'>Website</Label>
              <Input
                id='profile-website'
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder='https://example.com'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='profile-location'>Location</Label>
              <Input
                id='profile-location'
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder='Kigali, Rwanda'
              />
            </div>
          </div>

          <div className='space-y-3'>
            <Label>Social links</Label>
            <div className='grid gap-3 sm:grid-cols-2'>
              {(
                [
                  ['twitter', 'X / Twitter', 'https://x.com/handle'],
                  ['github', 'GitHub', 'https://github.com/handle'],
                  ['linkedin', 'LinkedIn', 'https://linkedin.com/in/handle'],
                  ['website', 'Other', 'https://…'],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key} className='space-y-1.5'>
                  <Label htmlFor={`social-${key}`} className='text-muted-foreground text-xs'>
                    {label}
                  </Label>
                  <Input
                    id={`social-${key}`}
                    value={social[key]}
                    onChange={(e) => setSocial((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className='flex justify-end'>
            <Button type='submit' disabled={isSaving || !!formatError || isTaken}>
              {isSaving && <IconLoader2 className='size-4 animate-spin' />}
              Save profile
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
