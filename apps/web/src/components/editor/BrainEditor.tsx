import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import {
  Editor,
  migrateContent,
  toMarkdown,
  type EditorHandle,
  type JSONContent,
} from '@lemma/editor'
import '@lemma/editor/styles/editor.css'

import { documentStore } from '@/stores/document-store'
import { getPreSignedUrl } from '@/lib/api/uploads'

// Image upload function using the API
const uploadImage = async (file: File): Promise<{ url: string; filename: string }> => {
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

export interface BrainEditorProps {
  documentId: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
  onReady?: () => void
  onChange?: () => void
}

export function BrainEditor({
  documentId,
  placeholder = 'Start writing...',
  className,
  autoFocus = false,
  onReady,
  onChange,
}: BrainEditorProps) {
  const editorRef = useRef<EditorHandle>(null)
  const [isClient, setIsClient] = useState(false)
  const [initialContent, setInitialContent] = useState<JSONContent | null>(null)

  // Set client-side flag
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Get initial content from document store
  useEffect(() => {
    const state = documentStore.getState()
    const doc = state.documents[documentId]

    if (!doc?.content) {
      setInitialContent({ type: 'doc', content: [{ type: 'paragraph' }] })
      return
    }

    // Migrate content from any format to Tiptap JSON
    const migratedContent = migrateContent(doc.content)
    setInitialContent(migratedContent)
  }, [documentId])

  // Handle content updates
  const handleUpdate = useCallback(
    ({ content, markdown }: { content: JSONContent; markdown: string }) => {
      // Save to document store
      documentStore.getState().updateDocument({
        id: documentId,
        content: content,
        markdown: markdown,
      })

      // Notify parent
      onChange?.()
    },
    [documentId, onChange]
  )

  // Handle editor ready
  const handleFocus = useCallback(() => {
    onReady?.()
  }, [onReady])

  // Don't render on server
  if (!isClient || !initialContent) {
    return <div className={className}>Loading editor...</div>
  }

  return (
    <div className={`brain-editor ${className || ''}`}>
      <Editor
        ref={editorRef}
        content={initialContent}
        placeholder={placeholder}
        autofocus={autoFocus}
        onUpdate={handleUpdate}
        onFocus={handleFocus}
        onImageUpload={uploadImage}
        className="min-h-[200px]"
      />
    </div>
  )
}

export interface BrainReadOnlyEditorProps {
  content: unknown
  className?: string
}

export function BrainReadOnlyEditor({ content, className }: BrainReadOnlyEditorProps) {
  const [isClient, setIsClient] = useState(false)
  const [parsedContent, setParsedContent] = useState<JSONContent | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!content) {
      setParsedContent({ type: 'doc', content: [{ type: 'paragraph' }] })
      return
    }

    const migratedContent = migrateContent(content)
    setParsedContent(migratedContent)
  }, [content])

  if (!isClient || !parsedContent) {
    return <div className={className}>Loading...</div>
  }

  return (
    <div className={`brain-editor read-only ${className || ''}`}>
      <Editor
        content={parsedContent}
        editable={false}
        className="min-h-0"
      />
    </div>
  )
}

export interface BrainTitleProps {
  documentId: string
  placeholder?: string
  className?: string
  onChange?: (title: string) => void
  onChangeSubtitle?: (subtitle: string) => void
}

export function BrainTitle({
  documentId,
  placeholder = 'Untitled',
  className,
  onChange,
  onChangeSubtitle,
}: BrainTitleProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const subtitleRef = useRef<HTMLTextAreaElement>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')

  // Load title and subtitle from document store on mount
  useEffect(() => {
    const doc = documentStore.getState().documents[documentId]
    if (doc) {
      setTitle(doc.title || '')
      setSubtitle(doc.subtitle || '')
    }
  }, [documentId])

  // Subscribe to document store changes
  useEffect(() => {
    const unsubscribe = documentStore.subscribe((state) => {
      const doc = state.documents[documentId]
      if (doc) {
        setTitle(doc.title || '')
        setSubtitle(doc.subtitle || '')
      }
    })
    return unsubscribe
  }, [documentId])

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setTitle(newTitle)
      onChange?.(newTitle)
    },
    [onChange]
  )

  const handleSubtitleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newSubtitle = e.target.value
      setSubtitle(newSubtitle)
      onChangeSubtitle?.(newSubtitle)
    },
    [onChangeSubtitle]
  )

  return (
    <div className={`brain-title-container ${className || ''}`}>
      <input
        ref={titleRef}
        type='text'
        className='brain-title'
        value={title}
        onChange={handleTitleChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          fontSize: '2.5em',
          fontWeight: '700',
          background: 'transparent',
          lineHeight: '1.2',
        }}
      />
      <textarea
        ref={subtitleRef}
        className='brain-subtitle'
        value={subtitle}
        onChange={handleSubtitleChange}
        placeholder='Add a subtitle...'
        rows={1}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          fontSize: '1.1em',
          fontWeight: '400',
          background: 'transparent',
          color: '#6b7280',
          resize: 'none',
          overflow: 'hidden',
          marginTop: '0.5em',
        }}
      />
    </div>
  )
}

// Utility exports
export { toMarkdown }

// For backwards compatibility
export function slateToMarkdown(content: unknown): string {
  if (typeof content === 'string') return content

  const migratedContent = migrateContent(content)
  return toMarkdown(migratedContent)
}

// Get default editor value (empty Tiptap document)
export function getDefaultEditorValue(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}
