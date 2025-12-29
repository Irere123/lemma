import { IconDotsVertical, IconEdit, IconKey, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type OAuthApp, useOAuthAppsModalStore } from '@/stores/oauth-apps-modal'
import { useTRPC } from '@/trpc/client'

function StatusBadge({ status }: { status: OAuthApp['status'] }) {
  const variants: Record<
    OAuthApp['status'],
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    draft: { variant: 'secondary', label: 'Draft' },
    pending: { variant: 'outline', label: 'Pending Review' },
    approved: { variant: 'default', label: 'Approved' },
    rejected: { variant: 'destructive', label: 'Rejected' },
  }

  const { variant, label } = variants[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function OAuthAppsTable() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { setData, setClientSecret } = useOAuthAppsModalStore()

  const { data, isLoading } = useQuery(trpc.oauthApplications.list.queryOptions())

  const regenerateSecretMutation = useMutation(
    trpc.oauthApplications.regenerateSecret.mutationOptions({
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: [['oauthApplications', 'list']] })
        toast.success('Client secret regenerated successfully')
        // Find the app and show credentials
        const app = applications?.find((a) => a.id === variables.id)
        if (app && data.clientSecret) {
          setClientSecret(data.clientSecret)
          setData(app as unknown as OAuthApp, 'view-credentials')
        }
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to regenerate client secret')
      },
    })
  )

  const applications = data?.data

  if (isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-12 w-full' />
        <Skeleton className='h-12 w-full' />
        <Skeleton className='h-12 w-full' />
      </div>
    )
  }

  if (!applications || applications.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center rounded-lg border border-dashed py-12'>
        <IconKey className='mb-4 text-muted-foreground' size={40} />
        <h3 className='mb-1 font-semibold'>No OAuth Applications</h3>
        <p className='text-muted-foreground text-sm'>
          Create your first OAuth application to get started
        </p>
      </div>
    )
  }

  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Application</TableHead>
            <TableHead>Client ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className='w-[50px]' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.id}>
              <TableCell>
                <div className='flex items-center gap-3'>
                  {app.logoUrl ? (
                    <img
                      src={app.logoUrl}
                      alt={app.name}
                      className='h-8 w-8 rounded-lg object-cover'
                    />
                  ) : (
                    <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-muted'>
                      <span className='font-medium text-sm'>
                        {app.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className='font-medium'>{app.name}</p>
                    {app.description && (
                      <p className='line-clamp-1 text-muted-foreground text-xs'>
                        {app.description}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <code className='rounded bg-muted px-2 py-1 font-mono text-xs'>
                  {app.clientId.slice(0, 20)}...
                </code>
              </TableCell>
              <TableCell>
                <StatusBadge status={app.status as OAuthApp['status']} />
              </TableCell>
              <TableCell className='text-muted-foreground text-sm'>
                {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon'>
                      <IconDotsVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={() => setData(app as unknown as OAuthApp, 'edit')}>
                      <IconEdit size={14} />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setClientSecret(null)
                        setData(app as unknown as OAuthApp, 'view-credentials')
                      }}
                    >
                      <IconKey size={14} />
                      View Credentials
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => regenerateSecretMutation.mutate({ id: app.id })}
                      disabled={regenerateSecretMutation.isPending}
                    >
                      <IconRefresh size={14} />
                      Regenerate Secret
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className='text-destructive focus:text-destructive'
                      onClick={() => setData(app as unknown as OAuthApp, 'delete')}
                    >
                      <IconTrash size={14} />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
