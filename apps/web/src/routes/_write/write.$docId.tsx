import {
  IconArrowLeft,
  IconCloud,
  IconCloudCheck,
  IconLoader2
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  Editor,
  migrateContent,
  type EditorHandle,
  type JSONContent,
} from '@lemma/editor'
import '@lemma/editor/styles/editor.css'

import { getPreSignedUrl } from '@/lib/api/uploads'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/_write/write/$docId')({
  loader: async ({ params, context }) => {
    const { docId } = params

    if (typeof window === 'undefined') {
      const { serverPrefetch } = await import('@/trpc/server')
      const request = (context as any)?.request as Request | undefined

      await serverPrefetch({
        request,
        queryKey: [['documents', 'getDocumentById'], { input: { id: docId }, type: 'query' }],
        fetchFn: (client) => client.documents.getDocumentById.query({ id: docId }),
      })
    }
  },
  component: FocusedWritingPage,
})

// Image upload function
async function uploadImage(file: File): Promise<{ url: string; filename: string }> {
  const { preSignedUrl, filename } = await getPreSignedUrl({
    fileSize: file.size,
    contentType: file.type,
    filename: file.name,
  })

  await axios.put(preSignedUrl, file, {
    headers: { 'Content-Type': file.type },
  })

  return {
    url: `https://assets.irere.dev/${filename}`,
    filename,
  }
}

function FocusedWritingPage() {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { docId } = Route.useParams()

  const editorRef = useRef<EditorHandle>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [content, setContent] = useState<JSONContent | null>(null)
  const [isSynced, setIsSynced] = useState(true)
  const [wordCount, setWordCount] = useState(0)

  // Fetch document
  const { data: document, isLoading } = useQuery(
    trpc.documents.getDocumentById.queryOptions({ id: docId })
  )

  // Mutation for saving
  const { mutateAsync: saveDocument, isPending: isSaving } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  )

  // Initialize content when document loads
  useEffect(() => {
    if (document) {
      setTitle(document.title || '')
      setSubtitle(document.subtitle || '')

      if (document.content) {
        const migrated = migrateContent(document.content)
        setContent(migrated)
      } else {
        setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
      }
    }
  }, [document])

  // Auto-resize title textarea
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto'
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`
    }
  }, [title])

  // Save handler with debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setIsSynced(false)

    saveTimeoutRef.current = setTimeout(async () => {
      const currentContent = editorRef.current?.getContent()
      const markdown = editorRef.current?.getMarkdown() || ''

      try {
        await saveDocument({
          id: docId,
          title: title || 'Untitled',
          subtitle: subtitle || null,
          content: currentContent as any,
          markdown,
        })

        await queryClient.invalidateQueries({
          queryKey: [['documents', 'getDocumentById'], { input: { id: docId } }],
        })

        setIsSynced(true)
      } catch (error) {
        console.error('Failed to save:', error)
      }
    }, 1500)
  }, [docId, title, subtitle, saveDocument, queryClient])

  // Handle content update from editor
  const handleEditorUpdate = useCallback(
    ({ content: newContent }: { content: JSONContent; markdown: string }) => {
      setContent(newContent)

      // Count words
      const text = editorRef.current?.editor?.getText() || ''
      const words = text.trim().split(/\s+/).filter(Boolean).length
      setWordCount(words)

      triggerSave()
    },
    [triggerSave]
  )

  // Handle title/subtitle changes
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTitle(e.target.value)
      triggerSave()
    },
    [triggerSave]
  )

  const handleSubtitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSubtitle(e.target.value)
      triggerSave()
    },
    [triggerSave]
  )

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        triggerSave()
      }

      // Escape to go back
      if (e.key === 'Escape') {
        navigate({ to: '/documents' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [triggerSave, navigate])

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSynced) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes.'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isSynced])

  if (isLoading || !content) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <IconLoader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Minimal Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate({ to: '/documents' })}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <IconArrowLeft size={18} />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-center gap-4">
            {/* Sync Status */}
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              {isSaving ? (
                <>
                  <IconLoader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isSynced ? (
                <>
                  <IconCloudCheck size={14} className="text-green-500" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <IconCloud size={14} />
                  <span>Unsaved</span>
                </>
              )}
            </div>

            {/* Word Count */}
            <div className="text-sm text-zinc-400">
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </div>
          </div>
        </div>
      </header>

      {/* Writing Area */}
      <main className="flex-1 overflow-y-auto">
        <article className="max-w-3xl mx-auto px-6 py-12">
          {/* Title */}
          <textarea
            ref={titleRef}
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled"
            className="w-full text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 bg-transparent border-none outline-none resize-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700 leading-tight"
            rows={1}
          />

          {/* Subtitle */}
          <input
            value={subtitle}
            onChange={handleSubtitleChange}
            placeholder="Add a subtitle..."
            className="w-full mt-4 text-xl text-zinc-500 dark:text-zinc-400 bg-transparent border-none outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
          />

          {/* Divider */}
          <div className="my-8 border-t border-zinc-100 dark:border-zinc-800" />

          {/* Editor */}
          <div className="prose prose-zinc dark:prose-invert prose-lg max-w-none">
            <Editor
              ref={editorRef}
              content={content}
              placeholder="Start writing your story..."
              autofocus={true}
              onUpdate={handleEditorUpdate}
              onImageUpload={uploadImage}
              className="min-h-[60vh] focus:outline-none"
            />
          </div>
        </article>
      </main>

      {/* Footer with keyboard hints */}
      <footer className="sticky bottom-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-t border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 h-10 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">/</kbd>
              {' '}for commands
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">Cmd+S</kbd>
              {' '}to save
            </span>
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">Esc</kbd>
            {' '}to exit
          </div>
        </div>
      </footer>
    </div>
  )
}
