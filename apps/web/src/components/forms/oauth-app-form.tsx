import { IconLoader2, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type OAuthApp, useOAuthAppsModalStore } from '@/stores/oauth-apps-modal'
import { useTRPC } from '@/trpc/client'

interface OAuthAppFormData {
  name: string
  description: string
  overview: string
  website: string
  logoUrl: string
  installUrl: string
  redirectUris: string[]
  isPublic: boolean
}

interface OAuthAppFormProps {
  app?: OAuthApp | null
  onSuccess?: () => void
}

export function OAuthAppForm({ app, onSuccess }: OAuthAppFormProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { setClientSecret, setData, close } = useOAuthAppsModalStore()
  const [redirectUris, setRedirectUris] = useState<string[]>(app?.redirectUris || [''])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OAuthAppFormData>({
    defaultValues: {
      name: app?.name || '',
      description: app?.description || '',
      overview: app?.overview || '',
      website: app?.website || '',
      logoUrl: app?.logoUrl || '',
      installUrl: app?.installUrl || '',
      isPublic: app?.isPublic || false,
    },
  })

  const createMutation = useMutation(
    trpc.oauthApplications.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: [['oauthApplications', 'list']] })
        toast.success('OAuth application created successfully')
        // Show credentials modal
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
          setData(data as unknown as OAuthApp, 'view-credentials')
        } else {
          close()
        }
        onSuccess?.()
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create OAuth application')
      },
    })
  )

  const updateMutation = useMutation(
    trpc.oauthApplications.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [['oauthApplications', 'list']] })
        toast.success('OAuth application updated successfully')
        close()
        onSuccess?.()
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update OAuth application')
      },
    })
  )

  const isLoading = createMutation.isPending || updateMutation.isPending

  const addRedirectUri = () => {
    setRedirectUris([...redirectUris, ''])
  }

  const removeRedirectUri = (index: number) => {
    if (redirectUris.length > 1) {
      setRedirectUris(redirectUris.filter((_, i) => i !== index))
    }
  }

  const updateRedirectUri = (index: number, value: string) => {
    const updated = [...redirectUris]
    updated[index] = value
    setRedirectUris(updated)
  }

  const onSubmit = (data: OAuthAppFormData) => {
    const validRedirectUris = redirectUris.filter((uri) => uri.trim() !== '')

    if (validRedirectUris.length === 0) {
      toast.error('At least one redirect URI is required')
      return
    }

    const formData = {
      ...data,
      redirectUris: validRedirectUris,
      scopes: ['read', 'write'], // Default scopes
    }

    if (app) {
      updateMutation.mutate({ id: app.id, ...formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-5'>
      <div className='space-y-2'>
        <Label htmlFor='name'>Application Name *</Label>
        <Input
          id='name'
          nativeInput
          placeholder='My Awesome App'
          {...register('name', { required: 'Application name is required' })}
        />
        <p className='text-muted-foreground text-xs'>
          The public name shown to users during authorization.
        </p>
        {errors.name && <p className='text-destructive text-sm'>{errors.name.message}</p>}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='description'>Short Description</Label>
        <Input
          id='description'
          nativeInput
          placeholder='A brief description of your app'
          {...register('description')}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='overview'>Overview</Label>
        <textarea
          id='overview'
          className='flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
          placeholder='Detailed description of what your app does'
          {...register('overview')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='website'>Website URL</Label>
          <Input
            id='website'
            nativeInput
            type='url'
            placeholder='https://yourapp.com'
            {...register('website')}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='logoUrl'>Logo URL</Label>
          <Input
            id='logoUrl'
            nativeInput
            type='url'
            placeholder='https://yourapp.com/logo.png'
            {...register('logoUrl')}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='installUrl'>Install URL</Label>
        <Input
          id='installUrl'
          nativeInput
          type='url'
          placeholder='https://yourapp.com/install'
          {...register('installUrl')}
        />
      </div>

      <div className='space-y-2'>
        <div className='rounded-lg border bg-muted/20 p-3 space-y-3'>
          <div className='flex items-center justify-between'>
            <Label>Redirect URIs *</Label>
            <Button type='button' variant='ghost' size='sm' onClick={addRedirectUri}>
              <IconPlus size={14} />
              Add URI
            </Button>
          </div>
          <p className='text-muted-foreground text-xs'>
            Authorized callback URLs where users are redirected after login.
          </p>
          {redirectUris.map((uri, index) => (
            <div key={index} className='flex gap-2'>
              <Input
                nativeInput
                value={uri}
                onChange={(e) => updateRedirectUri(index, e.target.value)}
                placeholder='https://yourapp.com/callback'
                type='url'
              />
              {redirectUris.length > 1 && (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={() => removeRedirectUri(index)}
                >
                  <IconTrash size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className='rounded-lg border bg-muted/20 p-3'>
        <div className='flex items-start gap-2'>
          <input
            type='checkbox'
            id='isPublic'
            {...register('isPublic')}
            className='rounded mt-0.5'
          />
          <div className='space-y-1'>
            <Label htmlFor='isPublic' className='font-normal'>
              Public client (no client secret required)
            </Label>
            <p className='text-muted-foreground text-xs'>
              Enable this for native/browser apps that cannot store secrets securely.
            </p>
          </div>
        </div>
      </div>

      <Button type='submit' className='w-full mt-2' disabled={isLoading}>
        {isLoading && <IconLoader2 className='animate-spin' size={16} />}
        {app ? 'Update Application' : 'Create Application'}
      </Button>
    </form>
  )
}
