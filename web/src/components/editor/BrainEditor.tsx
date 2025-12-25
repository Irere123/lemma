import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import axios from 'axios'

import {
  EditorProvider,
  EditorContent,
  BubbleMenu,
  DragHandle,
  SlashMenu,
  useSlashMenuState,
  useEditor,
  schema,
  createEditorPlugins,
  createNodeViews,
  injectNodeViewStyles,
  bubbleMenuStyles,
  dragHandleComponentStyles,
  dragHandleStyles,
  placeholderStyles,
  nodeViewStyles,
  toMarkdown,
  fromMarkdown,
  migrateFromSlate,
  closeSlashMenu,
  type ProseMirrorNode,
} from '@lemma/editor'

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import activeEditorsStore from '@/stores/active-editors-store'
import { documentStore } from '@/stores/document-store'
import { getPreSignedUrl } from '@/lib/api/uploads'

// Inject editor styles once
if (typeof document !== 'undefined') {
  injectNodeViewStyles()

  const styleId = 'prosemirror-editor-styles'
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style')
    styleElement.id = styleId
    styleElement.textContent = `
      ${bubbleMenuStyles}
      ${dragHandleComponentStyles}
      ${dragHandleStyles}
      ${placeholderStyles}
      ${nodeViewStyles}

      /* Base editor styles - Notion-like focused writing mode */
      .ProseMirror {
        outline: none;
        min-height: 200px;
        font-size: 16px;
        line-height: 1.75;
        color: #37352f;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol";
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .ProseMirror {
          color: #ffffffcf;
        }
      }

      /* Paragraphs */
      .ProseMirror p {
        margin: 0;
        padding: 3px 0;
      }

      .ProseMirror p + p {
        margin-top: 0;
      }

      /* Headings */
      .ProseMirror h1 {
        font-size: 1.875em;
        font-weight: 700;
        line-height: 1.3;
        margin-top: 2em;
        margin-bottom: 4px;
        padding: 3px 0;
      }

      .ProseMirror h2 {
        font-size: 1.5em;
        font-weight: 600;
        line-height: 1.3;
        margin-top: 1.4em;
        margin-bottom: 1px;
        padding: 3px 0;
      }

      .ProseMirror h3 {
        font-size: 1.25em;
        font-weight: 600;
        line-height: 1.3;
        margin-top: 1em;
        margin-bottom: 1px;
        padding: 3px 0;
      }

      .ProseMirror h4 {
        font-size: 1em;
        font-weight: 600;
        line-height: 1.3;
        margin-top: 1em;
        margin-bottom: 1px;
        padding: 3px 0;
      }

      /* First child shouldn't have top margin */
      .ProseMirror > *:first-child {
        margin-top: 0 !important;
      }

      /* Lists */
      .ProseMirror ul,
      .ProseMirror ol {
        padding-left: 1.7em;
        margin: 0;
        padding-top: 3px;
        padding-bottom: 3px;
      }

      .ProseMirror li {
        padding: 3px 0;
      }

      .ProseMirror li > p {
        margin: 0;
        padding: 0;
      }

      .ProseMirror li::marker {
        color: #37352f;
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror li::marker {
          color: #ffffffcf;
        }
      }

      /* Blockquote - Notion style with left border */
      .ProseMirror blockquote {
        border-left: 3px solid #37352f;
        padding-left: 14px;
        padding-right: 14px;
        margin: 4px 0;
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror blockquote {
          border-left-color: #ffffff80;
        }
      }

      /* Callout blocks - Notion style */
      .ProseMirror [data-type="callout"] {
        display: flex;
        border-radius: 4px;
        padding: 16px 16px 16px 12px;
        margin: 4px 0;
        background: rgba(235, 236, 237, 0.3);
        border-left: 4px solid #f0b849;
      }

      .ProseMirror [data-type="callout"][data-variant="info"] {
        background: rgba(221, 235, 241, 0.3);
        border-left-color: #5b9bd5;
      }

      .ProseMirror [data-type="callout"][data-variant="warning"] {
        background: rgba(251, 243, 219, 0.3);
        border-left-color: #f0b849;
      }

      .ProseMirror [data-type="callout"][data-variant="success"] {
        background: rgba(221, 237, 226, 0.3);
        border-left-color: #5bb98b;
      }

      .ProseMirror [data-type="callout"][data-variant="error"] {
        background: rgba(253, 235, 236, 0.3);
        border-left-color: #eb5757;
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror [data-type="callout"] {
          background: rgba(55, 53, 47, 0.3);
        }

        .ProseMirror [data-type="callout"][data-variant="info"] {
          background: rgba(45, 66, 86, 0.3);
        }

        .ProseMirror [data-type="callout"][data-variant="warning"] {
          background: rgba(68, 58, 32, 0.3);
        }

        .ProseMirror [data-type="callout"][data-variant="success"] {
          background: rgba(36, 61, 48, 0.3);
        }

        .ProseMirror [data-type="callout"][data-variant="error"] {
          background: rgba(82, 46, 46, 0.3);
        }
      }

      /* Code blocks - Notion style */
      .ProseMirror pre {
        background: #f7f6f3;
        border-radius: 4px;
        padding: 32px 16px 32px 32px;
        margin: 4px 0;
        overflow-x: auto;
        font-family: "SFMono-Regular", Menlo, Consolas, "PT Mono", "Liberation Mono", Courier, monospace;
        font-size: 0.875em;
        line-height: 1.5;
        tab-size: 2;
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror pre {
          background: #2f3437;
        }
      }

      .ProseMirror pre code {
        background: none;
        padding: 0;
        border-radius: 0;
        font-size: inherit;
      }

      /* Inline code */
      .ProseMirror code {
        font-family: "SFMono-Regular", Menlo, Consolas, "PT Mono", "Liberation Mono", Courier, monospace;
        font-size: 0.875em;
        background: rgba(135, 131, 120, 0.15);
        padding: 0.2em 0.4em;
        border-radius: 3px;
        color: #eb5757;
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror code {
          background: rgba(135, 131, 120, 0.3);
          color: #ff7875;
        }
      }

      /* Links */
      .ProseMirror a {
        color: #37352f;
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-color: rgba(55, 53, 47, 0.4);
        transition: text-decoration-color 0.1s ease;
      }

      .ProseMirror a:hover {
        text-decoration-color: rgba(55, 53, 47, 0.8);
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror a {
          color: #ffffffcf;
          text-decoration-color: rgba(255, 255, 255, 0.4);
        }

        .ProseMirror a:hover {
          text-decoration-color: rgba(255, 255, 255, 0.8);
        }
      }

      /* Divider / Horizontal rule */
      .ProseMirror hr {
        border: none;
        border-top: 1px solid rgba(55, 53, 47, 0.16);
        margin: 1.5em 0;
        padding: 0;
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror hr {
          border-top-color: rgba(255, 255, 255, 0.13);
        }
      }

      /* Images */
      .ProseMirror img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
      }

      .ProseMirror figure {
        margin: 8px 0;
      }

      .ProseMirror figcaption {
        text-align: center;
        font-size: 0.875em;
        color: #6b7280;
        margin-top: 8px;
      }

      /* Placeholder */
      .ProseMirror .placeholder {
        color: rgba(55, 53, 47, 0.4);
        pointer-events: none;
        position: absolute;
        font-style: normal;
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror .placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
      }

      /* Bold text */
      .ProseMirror strong {
        font-weight: 600;
      }

      /* Italic text */
      .ProseMirror em {
        font-style: italic;
      }

      /* Strikethrough */
      .ProseMirror s {
        text-decoration: line-through;
      }

      /* Highlight */
      .ProseMirror mark {
        background-color: #fff3bf;
        padding: 0 2px;
        border-radius: 2px;
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror mark {
          background-color: rgba(255, 212, 0, 0.3);
        }
      }

      /* Task list */
      .ProseMirror [data-type="taskList"] {
        list-style: none;
        padding-left: 0;
      }

      .ProseMirror [data-type="taskItem"] {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .ProseMirror [data-type="taskItem"][data-checked="true"] > p {
        text-decoration: line-through;
        color: rgba(55, 53, 47, 0.5);
      }

      @media (prefers-color-scheme: dark) {
        .ProseMirror [data-type="taskItem"][data-checked="true"] > p {
          color: rgba(255, 255, 255, 0.4);
        }
      }

      /* Toggle / Details */
      .ProseMirror details {
        margin: 4px 0;
      }

      .ProseMirror details summary {
        cursor: pointer;
        padding: 3px 0;
        outline: none;
      }

      .ProseMirror details summary::-webkit-details-marker {
        margin-right: 8px;
      }

      /* Selection highlight */
      .ProseMirror ::selection {
        background: rgba(45, 170, 219, 0.3);
      }

      /* Focus styles */
      .brain-editor:focus-within {
        /* Subtle focus indicator if needed */
      }
    `
    document.head.appendChild(styleElement)
  }
}

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

// Toast function adapter
const showToast = (message: string, type?: 'success' | 'error' | 'info') => {
  switch (type) {
    case 'success':
      toast.success(message)
      break
    case 'error':
      toast.error(message)
      break
    case 'info':
    default:
      toast.info(message)
      break
  }
}

export interface BrainEditorProps {
  documentId: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
  onReady?: () => void
  /** Called when editor content changes */
  onChange?: () => void
  /** Deprecated - not used in ProseMirror version */
  highlightedPath?: unknown
}

export function BrainEditor({
  documentId,
  placeholder = 'Start writing...',
  className,
  autoFocus = false,
  onReady,
  onChange,
}: BrainEditorProps) {
  const contentRef = useRef<ProseMirrorNode | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Get initial content from document store
  const getInitialContent = useCallback(() => {
    const state = documentStore.getState()
    const doc = state.documents[documentId]

    if (!doc?.content) {
      return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()])
    }

    // Check if content is Slate format (array of descendants) or ProseMirror format
    if (Array.isArray(doc.content)) {
      // Migrate from Slate to ProseMirror
      // Cast to unknown first since doc.content may be typed as Descendant[] from Slate
      try {
        return migrateFromSlate(doc.content as unknown as Parameters<typeof migrateFromSlate>[0], schema)
      } catch (e) {
        console.error('Failed to migrate Slate content:', e)
        return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()])
      }
    }

    // Already ProseMirror format (JSON)
    try {
      return schema.nodeFromJSON(doc.content)
    } catch (e) {
      console.error('Failed to parse ProseMirror content:', e)
      return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()])
    }
  }, [documentId])

  // Create plugins with slash menu callback
  const plugins = useMemo(
    () =>
      createEditorPlugins({
        placeholder,
        schema,
        enableDragHandle: true,
      }),
    [placeholder]
  )

  // Create node views
  const nodeViews = useMemo(() => createNodeViews(), [])

  // Initialize editor with proper options
  const { view, state, setContainer, isFocused, isEmpty } = useEditor({
    content: getInitialContent(),
    plugins,
    nodeViews,
    schema,
    autoFocus,
    placeholder,
  })

  // Track editor in active editors store
  useEffect(() => {
    if (view) {
      activeEditorsStore.addActiveEditor(documentId)
      onReady?.()
    }
    return () => {
      // Cleanup handled by store
    }
  }, [view, documentId, onReady])

  // Save content to document store on changes
  useEffect(() => {
    if (!view || !state) return

    const currentDoc = state.doc
    if (contentRef.current !== currentDoc) {
      contentRef.current = currentDoc

      // Save as ProseMirror JSON
      documentStore.getState().updateDocument({
        id: documentId,
        content: currentDoc.toJSON(),
      })

      // Notify parent of content change
      onChange?.()
    }
  }, [view, state, documentId, onChange])

  // Callback ref to set container when the div is mounted
  const containerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        editorContainerRef.current = node
        setContainer(node)
      }
    },
    [setContainer]
  )

  // Check if we're on the client side
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Don't render editor on server
  if (!isClient) {
    return <div className={className}>Loading editor...</div>
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`brain-editor ${className || ''}`}>
        <div
          ref={containerRefCallback}
          className='pm-editor-container ProseMirror focus:outline-none'
          style={{ minHeight: '200px' }}
        />
        {view && state && (
          <EditorProvider view={view} state={state} isFocused={isFocused} isEmpty={isEmpty}>
            <BubbleMenu />
            <DragHandle />
            <SlashMenuWrapper />
          </EditorProvider>
        )}
      </div>
    </TooltipProvider>
  )
}

// Wrapper component for SlashMenu that uses the context
function SlashMenuWrapper() {
  const { state: slashMenuState, closeMenu } = useSlashMenuState()
  return <SlashMenu state={slashMenuState} onClose={closeMenu} />
}

export interface BrainReadOnlyEditorProps {
  content: unknown // Can be Slate Descendant[] or ProseMirror JSON
  className?: string
}

export function BrainReadOnlyEditor({ content, className }: BrainReadOnlyEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Parse content
  const doc = useMemo(() => {
    if (!content) {
      return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()])
    }

    if (Array.isArray(content)) {
      // Slate format
      try {
        return migrateFromSlate(content as unknown as Parameters<typeof migrateFromSlate>[0], schema)
      } catch (e) {
        console.error('Failed to migrate Slate content:', e)
        return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()])
      }
    }

    // ProseMirror JSON format
    try {
      return schema.nodeFromJSON(content as any)
    } catch (e) {
      console.error('Failed to parse ProseMirror content:', e)
      return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()])
    }
  }, [content])

  const plugins = useMemo(
    () =>
      createEditorPlugins({
        placeholder: '',
        schema,
        enableDragHandle: false,
      }),
    []
  )

  const nodeViews = useMemo(() => createNodeViews(), [])

  const { view, state, setContainer, isFocused, isEmpty } = useEditor({
    content: doc,
    plugins,
    nodeViews,
    schema,
    editable: false,
  })

  // Callback ref to set container when the div is mounted
  const containerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        editorContainerRef.current = node
        setContainer(node)
      }
    },
    [setContainer]
  )

  // Check if we're on the client side
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Don't render editor on server
  if (!isClient) {
    return <div className={className}>Loading...</div>
  }

  return (
    <div className={`brain-editor read-only ${className || ''}`}>
      <div
        ref={containerRefCallback}
        className='pm-editor-container ProseMirror focus:outline-none'
      />
    </div>
  )
}

export interface BrainTitleProps {
  documentId: string
  placeholder?: string
  className?: string
  /** Called when title changes */
  onChange?: (title: string) => void
  /** Called when subtitle changes */
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
export { toMarkdown as prosemirrorToMarkdown, fromMarkdown as markdownToProsemirror }

// For backwards compatibility with Slate migration
// slateToMarkdown converts Slate Descendant[] to markdown
export function slateToMarkdown(content: unknown): string {
  // If content is already a string, return it
  if (typeof content === 'string') return content

  // If content is an array (Slate format), migrate to ProseMirror and convert
  if (Array.isArray(content)) {
    try {
      const pmDoc = migrateFromSlate(content, schema)
      return toMarkdown(pmDoc)
    } catch (e) {
      console.error('Failed to convert Slate to markdown:', e)
      return ''
    }
  }

  // If content is a ProseMirror JSON object, convert directly
  if (content && typeof content === 'object' && 'type' in content) {
    try {
      const pmDoc = schema.nodeFromJSON(content as any)
      return toMarkdown(pmDoc)
    } catch (e) {
      console.error('Failed to convert ProseMirror to markdown:', e)
      return ''
    }
  }

  return ''
}

// Get default editor value (empty ProseMirror document)
export function getDefaultEditorValue() {
  return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]).toJSON()
}

