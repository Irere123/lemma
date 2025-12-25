import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import axios from 'axios'

import {
  Editor,
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
      ${placeholderStyles}
      ${nodeViewStyles}

      .ProseMirror {
        outline: none;
        min-height: 200px;
        padding: 1rem;
        font-size: 16px;
        line-height: 1.6;
      }

      .ProseMirror p {
        margin: 0.5em 0;
      }

      .ProseMirror h1 {
        font-size: 2em;
        font-weight: 700;
        margin: 1em 0 0.5em;
      }

      .ProseMirror h2 {
        font-size: 1.5em;
        font-weight: 600;
        margin: 0.75em 0 0.5em;
      }

      .ProseMirror h3 {
        font-size: 1.25em;
        font-weight: 600;
        margin: 0.5em 0;
      }

      .ProseMirror h4 {
        font-size: 1.1em;
        font-weight: 600;
        margin: 0.5em 0;
      }

      .ProseMirror ul,
      .ProseMirror ol {
        padding-left: 1.5em;
        margin: 0.5em 0;
      }

      .ProseMirror li {
        margin: 0.25em 0;
      }

      .ProseMirror blockquote {
        border-left: 3px solid #e5e5e5;
        padding-left: 1em;
        margin: 0.5em 0;
        color: #666;
      }

      .ProseMirror code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.9em;
        background-color: #f5f5f5;
        padding: 0.15em 0.3em;
        border-radius: 3px;
      }

      .ProseMirror a {
        color: #3b82f6;
        text-decoration: underline;
      }

      .ProseMirror hr {
        border: none;
        border-top: 1px solid #e5e5e5;
        margin: 1.5em 0;
      }

      .ProseMirror img {
        max-width: 100%;
        height: auto;
      }

      .ProseMirror .placeholder {
        color: #9ca3af;
        pointer-events: none;
        position: absolute;
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
}

export function BrainEditor({
  documentId,
  placeholder = 'Start writing...',
  className,
  autoFocus = false,
  onReady,
}: BrainEditorProps) {
  const contentRef = useRef<ProseMirrorNode | null>(null)

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
      try {
        return migrateFromSlate(doc.content, schema)
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

  // Initialize editor
  const { view, state } = useEditor({
    schema,
    plugins,
    nodeViews,
    doc: getInitialContent(),
    autoFocus,
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
    }
  }, [view, state, documentId])

  // Get slash menu state and handlers using the hook
  const { state: slashMenuState, closeMenu } = useSlashMenuState()

  if (!view) {
    return <div className={className}>Loading editor...</div>
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`brain-editor ${className || ''}`}>
        <Editor view={view}>
          <EditorContent />
          <BubbleMenu />
          <DragHandle />
          <SlashMenu state={slashMenuState} onClose={closeMenu} />
        </Editor>
      </div>
    </TooltipProvider>
  )
}

export interface BrainReadOnlyEditorProps {
  content: unknown // Can be Slate Descendant[] or ProseMirror JSON
  className?: string
}

export function BrainReadOnlyEditor({ content, className }: BrainReadOnlyEditorProps) {
  // Parse content
  const doc = useMemo(() => {
    if (!content) {
      return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()])
    }

    if (Array.isArray(content)) {
      // Slate format
      try {
        return migrateFromSlate(content, schema)
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

  const { view } = useEditor({
    schema,
    plugins,
    nodeViews,
    doc,
    editable: false,
  })

  if (!view) {
    return <div className={className}>Loading...</div>
  }

  return (
    <div className={`brain-editor read-only ${className || ''}`}>
      <Editor view={view}>
        <EditorContent />
      </Editor>
    </div>
  )
}

export interface BrainTitleProps {
  documentId: string
  placeholder?: string
  className?: string
}

export function BrainTitle({ documentId, placeholder = 'Untitled', className }: BrainTitleProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Get title from document store
  const title = useMemo(() => {
    const state = documentStore.getState()
    return state.documents[documentId]?.title || ''
  }, [documentId])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      documentStore.getState().updateDocument({
        id: documentId,
        title: e.target.value,
      })
    },
    [documentId]
  )

  return (
    <input
      ref={inputRef}
      type='text'
      className={`brain-title ${className || ''}`}
      value={title}
      onChange={handleChange}
      placeholder={placeholder}
      style={{
        width: '100%',
        border: 'none',
        outline: 'none',
        fontSize: '2.5em',
        fontWeight: '700',
        background: 'transparent',
      }}
    />
  )
}

// Utility exports
export { toMarkdown as prosemirrorToMarkdown, fromMarkdown as markdownToProsemirror }

// Get default editor value (empty ProseMirror document)
export function getDefaultEditorValue() {
  return schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]).toJSON()
}

// Re-export types
export type { BrainEditorProps as EditorProps, BrainTitleProps as TitleProps }
