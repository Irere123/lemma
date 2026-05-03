import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import AdvancedEditor, { type WriterEditorUpdate } from '@/components/editor'
import { BackNavigationButton } from '@/components/navigation/back-navigation-button'
import { deleteUploadedFile, uploadFile } from '@/lib/api/uploads'
import { getSession } from '@/lib/auth.server'
import { type CustomBlockToken, extractCustomBlocksFromMarkdown } from '@/lib/custom-blocks'
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

type DraftState = {
  bannerImage: string | null
  customBlocks: CustomBlockToken[]
  markdown: string
  publishedDate: Date | null
  subtitle: string
  title: string
}

type DateValue = Date | string | null | undefined

const normalizeDateValue = (value: DateValue): Date | null => {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const areNullableDatesEqual = (first: Date | null, second: Date | null) =>
  (first?.getTime() ?? null) === (second?.getTime() ?? null)

function RouteComponent() {
  const { docId } = Route.useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const upsertDocumentInStore = useDocumentStore((state) => state.upsertDocument)
  const fallbackDocument = useDocumentStore((state) => state.documents[docId])

  const documentQueryOptions = trpc.documents.getDocumentById.queryOptions({ id: docId })
  const { data: fetchedDocument, isLoading } = useQuery(documentQueryOptions)
  const document = fetchedDocument ?? fallbackDocument

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [bannerImage, setBannerImage] = useState<string | null>(null)
  const [publishedDate, setPublishedDate] = useState<Date | null>(null)
  const [isBannerUploading, setIsBannerUploading] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Saved')

  const hydratedDocumentRef = useRef<string | null>(null)
  const draftRef = useRef<DraftState>({
    title: '',
    subtitle: '',
    bannerImage: null,
    markdown: '',
    publishedDate: null,
    customBlocks: [],
  })

  const { mutateAsync: upsertDocument, isPending: isUpsertLoading } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  )

  const persistDocument = useCallback(
    async (patch?: Record<string, unknown>) => {
      const payload = {
        id: docId,
        title: draftRef.current.title.trim() || null,
        subtitle: draftRef.current.subtitle.trim() || null,
        bannerImage: draftRef.current.bannerImage,
        markdown: draftRef.current.markdown,
        publishedDate: draftRef.current.publishedDate,
        ...patch,
      }

      const updatedDocument = await upsertDocument(payload as any)
      if (updatedDocument) {
        upsertDocumentInStore(updatedDocument as any)
        queryClient.setQueryData(documentQueryOptions.queryKey, updatedDocument)
        await queryClient.invalidateQueries({
          queryKey: trpc.documents.getUserDocuments.queryOptions({}).queryKey,
        })
      }

      return updatedDocument
    },
    [
      docId,
      documentQueryOptions.queryKey,
      queryClient,
      trpc.documents.getUserDocuments,
      upsertDocument,
      upsertDocumentInStore,
    ]
  )

  const persistDocumentDebounced = useDebouncedCallback(async () => {
    setSaveStatus('Saving...')
    try {
      await persistDocument()
      setSaveStatus('Saved')
    } catch (error) {
      console.error(error)
      setSaveStatus('Save failed')
    }
  }, 900)

  const queueDraftUpdate = (patch: Partial<DraftState>) => {
    let changed = false

    for (const [key, value] of Object.entries(patch)) {
      const typedKey = key as keyof DraftState

      if (typedKey === 'publishedDate') {
        const nextDate = value as DraftState['publishedDate']
        if (!areNullableDatesEqual(draftRef.current.publishedDate, nextDate)) {
          changed = true
          break
        }
        continue
      }

      if (!Object.is(draftRef.current[typedKey], value)) {
        changed = true
        break
      }
    }

    if (!changed) return

    draftRef.current = { ...draftRef.current, ...patch }
    setSaveStatus('Unsaved')
    persistDocumentDebounced()
  }

  const persistDocumentNow = useCallback(
    async (patch?: Record<string, unknown>) => {
      persistDocumentDebounced.cancel()
      setSaveStatus('Saving...')
      try {
        await persistDocument(patch)
        setSaveStatus('Saved')
        return true
      } catch (error) {
        console.error(error)
        setSaveStatus('Save failed')
        return false
      }
    },
    [persistDocument, persistDocumentDebounced]
  )

  useEffect(() => {
    if (!document) return
    const source = fetchedDocument ? 'server' : 'store'
    const hydrationKey = `${docId}:${source}`

    if (hydratedDocumentRef.current === hydrationKey) return

    // Never replace server data with fallback store data for the same document.
    if (source === 'store' && hydratedDocumentRef.current === `${docId}:server`) return

    hydratedDocumentRef.current = hydrationKey

    const nextTitle = document.title ?? ''
    const nextSubtitle = document.subtitle ?? ''
    const nextBannerImage = document.bannerImage ?? null
    const nextPublishedDate = normalizeDateValue(document.publishedDate)
    const nextMarkdown =
      typeof document.markdown === 'string' ? document.markdown : draftRef.current.markdown

    setTitle(nextTitle)
    setSubtitle(nextSubtitle)
    setBannerImage(nextBannerImage)
    setPublishedDate(nextPublishedDate)
    setSaveStatus('Saved')

    draftRef.current = {
      title: nextTitle,
      subtitle: nextSubtitle,
      bannerImage: nextBannerImage,
      publishedDate: nextPublishedDate,
      markdown: nextMarkdown,
      customBlocks: extractCustomBlocksFromMarkdown(nextMarkdown),
    }
  }, [docId, document, fetchedDocument])

  useEffect(
    () => () => {
      persistDocumentDebounced.flush()
    },
    [persistDocumentDebounced]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's'
      if (!isSaveShortcut) return

      event.preventDefault()
      void persistDocumentNow()
    }

    const onBeforeUnload = () => {
      persistDocumentDebounced.flush()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [persistDocumentDebounced, persistDocumentNow])

  const handleBannerImageSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setSaveStatus('Save failed')
        return
      }

      const previousBannerImage = draftRef.current.bannerImage
      let uploadedImageUrl: null | string = null

      setIsBannerUploading(true)
      setSaveStatus('Saving...')
      try {
        const uploaded = await uploadFile(file)
        const nextBannerImage = uploaded.url
        uploadedImageUrl = nextBannerImage

        setBannerImage(nextBannerImage)
        draftRef.current = { ...draftRef.current, bannerImage: nextBannerImage }
        const didPersist = await persistDocumentNow({ bannerImage: nextBannerImage })

        if (!didPersist) {
          setBannerImage(previousBannerImage)
          draftRef.current = { ...draftRef.current, bannerImage: previousBannerImage }

          if (uploadedImageUrl) {
            try {
              await deleteUploadedFile({ fileUrl: uploadedImageUrl })
            } catch (cleanupError) {
              console.error(
                'Failed to cleanup uploaded cover image after save failure',
                cleanupError
              )
            }
          }
          return
        }

        if (previousBannerImage && previousBannerImage !== nextBannerImage) {
          try {
            await deleteUploadedFile({ fileUrl: previousBannerImage })
          } catch (cleanupError) {
            console.error('Failed to delete previous cover image', cleanupError)
          }
        }
      } catch (error) {
        console.error(error)
        setSaveStatus('Save failed')
      } finally {
        setIsBannerUploading(false)
      }
    },
    [persistDocumentNow]
  )

  const handleBannerImageRemove = useCallback(async () => {
    const previousBannerImage = draftRef.current.bannerImage

    setBannerImage(null)
    draftRef.current = { ...draftRef.current, bannerImage: null }

    const didPersist = await persistDocumentNow({ bannerImage: null })
    if (!didPersist) {
      setBannerImage(previousBannerImage)
      draftRef.current = { ...draftRef.current, bannerImage: previousBannerImage }
      return
    }

    if (!previousBannerImage) return

    try {
      await deleteUploadedFile({ fileUrl: previousBannerImage })
    } catch (cleanupError) {
      console.error('Failed to delete removed cover image', cleanupError)
    }
  }, [persistDocumentNow])

  if (isLoading && !document) {
    return (
      <WriteRoomShell>
        <div className='mx-auto w-full max-w-[900px] px-4 py-10 text-sm md:px-6'>
          Loading draft...
        </div>
      </WriteRoomShell>
    )
  }

  if (!document) {
    return (
      <WriteRoomShell>
        <div className='mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-10 md:px-6'>
          <p className='text-sm text-muted-foreground'>Document not found.</p>
          <Link to='/app' className='text-sm font-medium underline underline-offset-4'>
            Return to documents
          </Link>
        </div>
      </WriteRoomShell>
    )
  }

  const editorKey = `${docId}:${fetchedDocument ? 'server' : 'store'}`
  const editorInitialContent = typeof document.markdown === 'string' ? document.markdown : ''

  return (
    <WriteRoomShell>
      <AdvancedEditor
        key={editorKey}
        className='pt-4'
        initialContent={editorInitialContent}
        title={title}
        subtitle={subtitle}
        bannerImage={bannerImage}
        publishedDate={publishedDate}
        isBannerUploading={isBannerUploading}
        saveStatus={isUpsertLoading ? 'Saving...' : saveStatus}
        onBannerImageSelect={handleBannerImageSelect}
        onBannerImageRemove={() => {
          void handleBannerImageRemove()
        }}
        onTitleChange={(value) => {
          setTitle(value)
          queueDraftUpdate({ title: value })
        }}
        onSubtitleChange={(value) => {
          setSubtitle(value)
          queueDraftUpdate({ subtitle: value })
        }}
        onPublishedDateChange={(value) => {
          setPublishedDate(value)
          queueDraftUpdate({ publishedDate: value })
        }}
        onContentChange={(value: WriterEditorUpdate) => {
          const markdown = value.markdown
          const customBlocks = extractCustomBlocksFromMarkdown(markdown)

          if (!hydratedDocumentRef.current) {
            draftRef.current = {
              ...draftRef.current,
              markdown,
              customBlocks,
            }
            return
          }

          queueDraftUpdate({
            markdown,
            customBlocks,
          })
        }}
      />
    </WriteRoomShell>
  )
}

function WriteRoomShell({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen w-full bg-background pb-20'>
      <header className='sticky top-0 z-40 border-border/70 border-b bg-background/95 backdrop-blur'>
        <div className='mx-auto flex w-full max-w-[900px] items-center justify-between px-4 py-3 md:px-6'>
          <BackNavigationButton label='Back' />
          <Link
            to='/app'
            className='text-muted-foreground text-sm transition-colors hover:text-foreground'
          >
            Library
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}
