import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ExternalLink,
  FileText,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import {
  DocumentRow,
  EmptyState,
  ListSkeleton,
  Page,
  PageHeader,
} from '@/components/workspace/page'
import { useCreate } from '@/hooks/use-create'
import { useSession } from '@/lib/auth-client'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/posts')({
  component: Posts,
})

type Filter = 'all' | 'DRAFT' | 'PUBLISHED'

function Posts() {
  const trpc = useTRPC()
  const create = useCreate()
  const { data: session } = useSession()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null)
  const queryClient = useQueryClient()

  const input = {
    kinds: ['post' as const],
    limit: 50,
    ...(filter === 'all' ? {} : { status: filter }),
  }
  const posts = useInfiniteQuery(
    trpc.documents.getUserDocuments.infiniteQueryOptions(input, {
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    })
  )
  const remove = useMutation(
    trpc.documents.deleteDocument.mutationOptions({
      onSuccess: () => {
        toast.success('Post deleted')
        setDeleting(null)
        void queryClient.invalidateQueries({ queryKey: trpc.documents.getUserDocuments.pathKey() })
      },
      onError: (error) => toast.error(error.message),
    })
  )

  const all = useMemo(() => posts.data?.pages.flatMap((page) => page.documents) ?? [], [posts.data])
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? all.filter((doc) => `${doc.title ?? ''} ${doc.excerpt ?? ''}`.toLowerCase().includes(needle))
    : all
  const username = session?.user?.username

  return (
    <Page>
      <PageHeader
        title='Posts'
        description='Everything you write for your readers: drafts, scheduled and published.'
        actions={
          <Button onClick={create.createPost} disabled={create.isPending}>
            <Plus />
            New post
          </Button>
        }
      />
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTab value='all'>All</TabsTab>
            <TabsTab value='DRAFT'>Drafts</TabsTab>
            <TabsTab value='PUBLISHED'>Published</TabsTab>
          </TabsList>
        </Tabs>
        <div className='relative w-full sm:w-64'>
          <Search className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 text-muted-foreground' />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder='Filter by title or text'
            aria-label='Filter posts'
            className='pl-8'
          />
        </div>
      </div>

      {posts.isLoading ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        needle ? (
          <p className='py-10 text-center text-[14px] text-muted-foreground'>
            No posts match “{query}”.
          </p>
        ) : (
          <EmptyState
            icon={<FileText />}
            title={filter === 'PUBLISHED' ? 'Nothing published yet' : 'No posts yet'}
            description='Posts are what your readers see on your page and in their inbox.'
            action={
              <Button onClick={create.createPost}>
                <Plus /> Write your first post
              </Button>
            }
          />
        )
      ) : (
        <ul className='flex flex-col divide-y divide-border/60'>
          {shown.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              trailing={
                <Menu>
                  <MenuTrigger
                    render={
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label={`Actions for ${doc.title || 'Untitled'}`}
                        className='bg-background shadow-surface'
                      >
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                  <MenuPopup align='end'>
                    <MenuItem render={<Link to='/write/$docId' params={{ docId: doc.id }} />}>
                      <NotebookPen /> Open
                    </MenuItem>
                    {doc.status === 'PUBLISHED' && username && doc.slug ? (
                      <MenuItem
                        render={
                          // biome-ignore lint/a11y/useAnchorContent: content comes from children
                          <a href={`/u/${username}/${doc.slug}`} target='_blank' rel='noreferrer' />
                        }
                      >
                        <ExternalLink /> View post
                      </MenuItem>
                    ) : null}
                    <MenuSeparator />
                    <MenuItem
                      variant='destructive'
                      onClick={() => setDeleting({ id: doc.id, title: doc.title || 'Untitled' })}
                    >
                      <Trash2 /> Delete
                    </MenuItem>
                  </MenuPopup>
                </Menu>
              }
            />
          ))}
        </ul>
      )}
      {posts.hasNextPage ? (
        <div className='mt-6 flex justify-center'>
          <Button
            variant='outline'
            onClick={() => posts.fetchNextPage()}
            disabled={posts.isFetchingNextPage}
          >
            Show more
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.title}”?`}
        description='The post and its version history are deleted. This can’t be undone.'
        confirmText='Delete'
        confirmVariant='destructive'
        isConfirmLoading={remove.isPending}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </Page>
  )
}
