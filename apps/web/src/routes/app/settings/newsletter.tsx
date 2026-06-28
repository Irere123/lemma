import { IconLoader2 } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/settings/newsletter')({
  component: RouteComponent,
})

function RouteComponent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const settingsQuery = trpc.newsletter.getWriterNewsletterSettings.queryOptions()
  const { data: settings, isLoading } = useQuery(settingsQuery)
  const upsert = useMutation(trpc.newsletter.upsertNewsletterSettings.mutationOptions())

  const [newsletterName, setNewsletterName] = useState('')
  const [fromName, setFromName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [brandColor, setBrandColor] = useState('#000000')
  const [confirmationUrl, setConfirmationUrl] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!settings) return
    setNewsletterName(settings.newsletterName ?? '')
    setFromName(settings.fromName ?? '')
    setLogoUrl(settings.logoUrl ?? '')
    setBrandColor(settings.brandColor ?? '#000000')
    setConfirmationUrl(settings.confirmationUrl ?? '')
    setIsActive(settings.isActive ?? true)
  }, [settings])

  // Prefill the confirm-page URL for a fresh newsletter so subscription emails
  // link somewhere valid out of the box. The writer can still override it.
  const defaultConfirmationUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/subscribe/confirm` : ''

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await upsert.mutateAsync({
        id: settings?.id,
        newsletterName: newsletterName.trim(),
        fromName: fromName.trim(),
        logoUrl: logoUrl.trim() || undefined,
        brandColor,
        confirmationUrl: confirmationUrl.trim() || defaultConfirmationUrl || undefined,
        isActive,
      })
      await queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey })
      toast.success('Newsletter settings saved')
    } catch {
      toast.error('Could not save newsletter settings')
    }
  }

  return (
    <section className='space-y-6'>
      <div className='space-y-2'>
        <h3 className='font-semibold text-xl tracking-tight'>Newsletter</h3>
        <p className='max-w-2xl text-muted-foreground text-sm'>
          How your newsletter appears in subscribers' inboxes. These details are used for the from
          line, confirmation emails, and every post you send.
        </p>
      </div>

      <form onSubmit={onSubmit} className='rounded-xl border bg-card p-6'>
        <fieldset disabled={isLoading || upsert.isPending} className='space-y-5'>
          <div className='flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='newsletter-active'>Newsletter enabled</Label>
              <p className='text-muted-foreground text-xs'>
                When off, the subscribe form is hidden from your public profile.
              </p>
            </div>
            <Switch id='newsletter-active' checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className='grid gap-5 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='newsletter-name'>Newsletter name</Label>
              <Input
                id='newsletter-name'
                value={newsletterName}
                onChange={(e) => setNewsletterName(e.target.value)}
                placeholder='The Weekly Lemma'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='newsletter-from'>From name</Label>
              <Input
                id='newsletter-from'
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder='Jane Doe'
                required
              />
            </div>
          </div>

          <div className='grid gap-5 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='newsletter-logo'>Logo URL</Label>
              <Input
                id='newsletter-logo'
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder='https://…/logo.png'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='newsletter-color'>Brand color</Label>
              <div className='flex items-center gap-2'>
                <input
                  id='newsletter-color'
                  type='color'
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className='size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-1'
                  aria-label='Brand color'
                />
                <Input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder='#000000'
                />
              </div>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='newsletter-confirm-url'>Confirmation page URL</Label>
            <Input
              id='newsletter-confirm-url'
              value={confirmationUrl}
              onChange={(e) => setConfirmationUrl(e.target.value)}
              placeholder={defaultConfirmationUrl}
            />
            <p className='text-muted-foreground text-xs'>
              Where subscribers land to confirm their email. Leave blank to use the default.
            </p>
          </div>

          <div className='flex justify-end'>
            <Button type='submit' disabled={upsert.isPending}>
              {upsert.isPending && <IconLoader2 className='size-4 animate-spin' />}
              Save newsletter
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
