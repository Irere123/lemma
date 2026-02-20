import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import AdvancedEditor, { type WriterEditorUpdate } from '@/components/editor'
import { extractCustomBlocksFromMarkdown, type CustomBlockToken } from '@/lib/custom-blocks'
import { useDocumentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/write/$docId')({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: `Write | Lemma`,
      },
    ],
  }),
})

type DraftState = {
  customBlocks: CustomBlockToken[]
  markdown: string
  subtitle: string
  title: string
}

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
  const [saveStatus, setSaveStatus] = useState('Saved')

  const hydratedDocumentRef = useRef<string | null>(null)
  const draftRef = useRef<DraftState>({
    title: '',
    subtitle: '',
    markdown: '',
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
        markdown: draftRef.current.markdown,
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
      } catch (error) {
        console.error(error)
        setSaveStatus('Save failed')
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
    const nextMarkdown =
      typeof document.markdown === 'string' ? document.markdown : draftRef.current.markdown

    setTitle(nextTitle)
    setSubtitle(nextSubtitle)
    setSaveStatus('Saved')

    draftRef.current = {
      title: nextTitle,
      subtitle: nextSubtitle,
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

  if (isLoading && !document) {
    return <div className='mx-auto w-full max-w-[860px] px-4 py-10 text-sm'>Loading draft...</div>
  }

  if (!document) {
    return (
      <div className='mx-auto flex w-full max-w-[860px] flex-col gap-4 px-4 py-10'>
        <p className='text-sm text-muted-foreground'>Document not found.</p>
        <Link to='/app' className='text-sm font-medium underline underline-offset-4'>
          Return to documents
        </Link>
      </div>
    )
  }

  const editorKey = `${docId}:${fetchedDocument ? 'server' : 'store'}`
  const editorInitialContent =
    typeof document.markdown === 'string' ? document.markdown : ''

  return (
    <div className='w-full pb-20'>
      <AdvancedEditor
        key={editorKey}
        className='pt-2'
        initialContent={editorInitialContent}
        title={title}
        subtitle={subtitle}
        saveStatus={isUpsertLoading ? 'Saving...' : saveStatus}
        onTitleChange={(value) => {
          setTitle(value)
          queueDraftUpdate({ title: value })
        }}
        onSubtitleChange={(value) => {
          setSubtitle(value)
          queueDraftUpdate({ subtitle: value })
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
    </div>
  )
}
