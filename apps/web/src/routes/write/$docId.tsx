import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type * as Y from 'yjs'

import AdvancedEditor from '@/components/editor'
import { BackNavigationButton } from '@/components/navigation/back-navigation-button'
import { DocumentEditorSkeleton } from '@/components/skeletons/document-editor-skeleton'
import { Button } from '@/components/ui/button'
import { deleteUploadedFile, uploadFile } from '@/lib/api/uploads'
import { getSession } from '@/lib/auth.server'
import { useDocumentSync, useSyncState, useYText } from '@/lib/collab/hooks'
import { buildSeoHead } from '@/lib/seo'
import { useDocumentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/write/$docId')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { user: session.data?.user }
  },
  head: ({ params }) =>
    buildSeoHead({
      canonicalPath: `/write/${params.docId}`,
      description: 'Write, refine, and publish your document in Lemma.',
      noIndex: true,
      title: 'Write',
      type: 'article',
    }),
  component: RouteComponent,
})

type DateValue = Date | string | null | undefined

const normalizeDateValue = (value: DateValue): Date | null => {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function RouteComponent() {
  const { docId } = Route.useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Metadata only; the title, subtitle and body sync through `sync`.
  const documentQueryOptions = trpc.documents.getDocumentById.queryOptions({ id: docId })
  const { data: document, isLoading } = useQuery(documentQueryOptions)
  const sync = useDocumentSync(docId)
  const ready = useSyncState(sync, (state) => state.ready)
  const closed = useSyncState(sync, (state) => state.closed)
  const offline = useSyncState(sync, (state) => state.save === 'offline')
  const outdated = useSyncState(sync, (state) => state.outdated)

  const [bannerImage, setBannerImage] = useState<string | null>(null)
  const [publishedDate, setPublishedDate] = useState<Date | null>(null)
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [isBannerUploading, setIsBannerUploading] = useState(false)

  useEffect(() => {
    if (!document) return
    setBannerImage(document.bannerImage ?? null)
    setPublishedDate(normalizeDateValue(document.publishedDate))
    setStatus(document.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')
  }, [document])

  useEffect(
    () => () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.documents.getUserDocuments.queryOptions({}).queryKey,
      })
    },
    [queryClient, trpc.documents.getUserDocuments]
  )

  // Saving is continuous; keep ⌘S from opening the browser's "Save page".
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        toast('Lemma saves as you type.', { id: 'autosave-hint' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { mutateAsync: upsertDocument, isPending: isUpsertLoading } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  )

  // Publishing, the cover and the date are explicit actions: online only, and
  // they fail visibly instead of queueing.
  const updateMetadata = useCallback(
    async (patch: {
      bannerImage?: string | null
      publishedDate?: Date | null
      status?: 'DRAFT' | 'PUBLISHED'
    }) => {
      try {
        const updated = await upsertDocument({ id: docId, ...patch })
        if (updated) queryClient.setQueryData(documentQueryOptions.queryKey, updated)
        return true
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : 'Could not update the document.')
        return false
      }
    },
    [docId, documentQueryOptions.queryKey, queryClient, upsertDocument]
  )

  const handleBannerImageSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('The cover must be an image.')
        return
      }

      const previous = bannerImage
      setIsBannerUploading(true)
      try {
        const uploaded = await uploadFile(file)
        setBannerImage(uploaded.url)
        if (!(await updateMetadata({ bannerImage: uploaded.url }))) {
          setBannerImage(previous)
          await deleteUploadedFile({ fileUrl: uploaded.url }).catch(() => {})
          return
        }
        if (previous && previous !== uploaded.url) {
          await deleteUploadedFile({ fileUrl: previous }).catch(() => {})
        }
      } catch (error) {
        console.error(error)
        toast.error('Could not upload the cover image.')
      } finally {
        setIsBannerUploading(false)
      }
    },
    [bannerImage, updateMetadata]
  )

  const handleBannerImageRemove = useCallback(async () => {
    const previous = bannerImage
    setBannerImage(null)
    if (!(await updateMetadata({ bannerImage: null }))) {
      setBannerImage(previous)
      return
    }
    if (previous) await deleteUploadedFile({ fileUrl: previous }).catch(() => {})
  }, [bannerImage, updateMetadata])

  const handlePublishedDateChange = useCallback(
    async (value: Date | null) => {
      const previous = publishedDate
      setPublishedDate(value)
      if (!(await updateMetadata({ publishedDate: value }))) setPublishedDate(previous)
    },
    [publishedDate, updateMetadata]
  )

  const handleStatusChange = useCallback(
    async (nextStatus: 'DRAFT' | 'PUBLISHED') => {
      const nextPublishedDate =
        nextStatus === 'PUBLISHED' ? (publishedDate ?? new Date()) : publishedDate
      const ok = await updateMetadata({ status: nextStatus, publishedDate: nextPublishedDate })
      if (!ok) return
      setStatus(nextStatus)
      setPublishedDate(nextPublishedDate)
      toast.success(nextStatus === 'PUBLISHED' ? 'Published' : 'Unpublished')
    },
    [publishedDate, updateMetadata]
  )

  const handleExportMarkdown = useCallback(async () => {
    try {
      const result = await queryClient.fetchQuery(
        trpc.documents.getMarkdown.queryOptions({ id: docId }, { staleTime: 0 })
      )
      const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `${(result.title || 'untitled').replace(/[^\w\- ]+/g, '').trim() || 'untitled'}.md`
      anchor.click()
      URL.revokeObjectURL(url)
      // Trailing spaces aren't worth a word; everything else Markdown dropped is.
      const lost = result.losses
        .filter((loss) => loss.feature !== 'trailingSpace')
        .map((loss) => `${loss.description.replace(/\s*\(.*\)$/, '')} (${loss.count})`)
      if (lost.length > 0) {
        toast.info(
          `Exported. Markdown can't hold everything here, so this was left out: ${lost.join(', ')}.`,
          {
            duration: 10_000,
          }
        )
      }
    } catch (error) {
      console.error(error)
      toast.error('Could not export this document.')
    }
  }, [docId, queryClient, trpc.documents.getMarkdown])

  const onBannerImageRemove = useCallback(() => {
    void handleBannerImageRemove()
  }, [handleBannerImageRemove])
  const onPublishedDateChange = useCallback(
    (value: Date | null) => {
      void handlePublishedDateChange(value)
    },
    [handlePublishedDateChange]
  )
  const onExportMarkdown = useCallback(() => {
    void handleExportMarkdown()
  }, [handleExportMarkdown])
  const onPublish = useCallback(() => {
    void handleStatusChange('PUBLISHED')
  }, [handleStatusChange])
  const onUnpublish = useCallback(() => {
    void handleStatusChange('DRAFT')
  }, [handleStatusChange])
  const { user } = Route.useRouteContext()
  const username = (user as { username?: string | null } | undefined)?.username
  const viewUrl =
    status === 'PUBLISHED' && username && document?.slug ? `/u/${username}/${document.slug}` : null

  if (isLoading && !document) {
    return (
      <WriteRoomShell>
        <DocumentEditorSkeleton />
      </WriteRoomShell>
    )
  }

  if (!document) {
    return (
      <WriteRoomShell>
        <div className='writer-column flex flex-col gap-4 py-16'>
          <p className='text-muted-foreground text-sm'>Document not found.</p>
          <Link to='/app' className='text-sm font-medium underline underline-offset-4'>
            Return to documents
          </Link>
        </div>
      </WriteRoomShell>
    )
  }

  if (sync && ready) {
    return (
      <>
        <SidebarTitle docId={docId} title={sync.title} />
        {outdated ? <OutdatedBanner /> : null}
        <AdvancedEditor
          key={docId}
          sync={sync}
          disabled={closed || outdated}
          status={status}
          isStatusUpdating={isUpsertLoading}
          viewUrl={viewUrl}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          bannerImage={bannerImage}
          publishedDate={publishedDate}
          isBannerUploading={isBannerUploading}
          onBannerImageSelect={handleBannerImageSelect}
          onBannerImageRemove={onBannerImageRemove}
          onPublishedDateChange={onPublishedDateChange}
          onExportMarkdown={onExportMarkdown}
        />
      </>
    )
  }

  return (
    <WriteRoomShell>
      {outdated ? <OutdatedBanner /> : null}
      {offline ? (
        <div className='writer-column py-16 text-muted-foreground text-sm'>
          You're offline, and this document hasn't been opened on this device before. It will open
          as soon as you're back online.
        </div>
      ) : (
        <DocumentEditorSkeleton />
      )}
    </WriteRoomShell>
  )
}

/**
 * Keeps the sidebar's title in step with the synced title. Its own component
 * so title keystrokes re-render only this, not the editor.
 */
function SidebarTitle({ docId, title: text }: { docId: string; title: Y.Text }) {
  const updateDocumentInStore = useDocumentStore((state) => state.updateDocument)
  const [title] = useYText(text)
  useEffect(() => {
    const timer = setTimeout(() => updateDocumentInStore({ id: docId, title: title || null }), 600)
    return () => clearTimeout(timer)
  }, [docId, title, updateDocumentInStore])
  return null
}

// The document was saved by a newer version of Lemma than this page runs.
function OutdatedBanner() {
  return (
    <div
      role='alert'
      className='fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm shadow-lg dark:bg-amber-950'
    >
      <span>
        Lemma has been updated. Reload to keep editing. Your changes so far are saved on this
        device.
      </span>
      <Button type='button' size='sm' onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  )
}

// Loading, offline and not-found states: the same bar, without the editor's actions.
function WriteRoomShell({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-dvh w-full bg-background'>
      <header className='sticky top-0 z-40 border-border/60 border-b bg-background/90 backdrop-blur'>
        <div className='mx-auto flex h-13 w-full max-w-5xl items-center px-3 md:px-5'>
          <BackNavigationButton label='Documents' className='text-muted-foreground' />
        </div>
      </header>
      {children}
    </div>
  )
}
