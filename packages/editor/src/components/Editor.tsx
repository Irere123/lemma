import type { JSONContent, Editor as TiptapEditor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { clsx } from 'clsx'
import { type ForwardedRef, forwardRef, useEffect, useImperativeHandle } from 'react'

import { createExtensions } from '../extensions'
import type { ImageUploadFn, LemmaEditorProps } from '../types'
import { BubbleMenu } from './menus/BubbleMenu'

export interface EditorHandle {
  editor: TiptapEditor | null
  getContent: () => JSONContent | null
  getMarkdown: () => string
  setContent: (content: JSONContent | string) => void
  focus: () => void
  blur: () => void
  isEmpty: () => boolean
}

export interface EditorProps extends LemmaEditorProps {
  onImageUpload?: ImageUploadFn
  onNoteLinkClick?: (noteId: string, noteTitle: string) => void
  showBubbleMenu?: boolean
}

function EditorComponent(
  {
    content,
    placeholder = "Start writing, or press '/' for commands...",
    editable = true,
    autofocus = false,
    onUpdate,
    onFocus,
    onBlur,
    onImageUpload,
    onNoteLinkClick,
    showBubbleMenu = true,
    className,
  }: EditorProps,
  ref: ForwardedRef<EditorHandle>
) {
  const extensions = createExtensions({
    placeholder,
    onNoteLinkClick,
  })

  const editor = useEditor({
    extensions,
    content: content || '',
    editable,
    autofocus,
    editorProps: {
      attributes: {
        class: clsx(
          'lemma-editor',
          'prose prose-stone dark:prose-invert',
          'max-w-none',
          'focus:outline-none',
          className
        ),
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files.length > 0) {
          const files = Array.from(event.dataTransfer.files)
          const images = files.filter((file) => file.type.startsWith('image/'))

          if (images.length > 0 && onImageUpload) {
            event.preventDefault()
            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            })

            images.forEach(async (image) => {
              try {
                const result = await onImageUpload(image)
                if (result && coordinates) {
                  const node = view.state.schema.nodes.imageBlock?.create({
                    src: result.url,
                    alt: result.filename,
                  })
                  if (node) {
                    const transaction = view.state.tr.insert(coordinates.pos, node)
                    view.dispatch(transaction)
                  }
                }
              } catch (error) {
                console.error('Image upload failed:', error)
              }
            })

            return true
          }
        }
        return false
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false

        for (const item of items) {
          if (item.type.startsWith('image/') && onImageUpload) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return false

            onImageUpload(file)
              .then((result) => {
                if (result) {
                  const node = view.state.schema.nodes.imageBlock?.create({
                    src: result.url,
                    alt: result.filename,
                  })
                  if (node) {
                    const transaction = view.state.tr.replaceSelectionWith(node)
                    view.dispatch(transaction)
                  }
                }
              })
              .catch((error) => {
                console.error('Image upload failed:', error)
              })

            return true
          }
        }

        return false
      },
    },
    onUpdate: ({ editor }) => {
      if (onUpdate) {
        const content = editor.getJSON()
        const markdown = editor.storage.markdown?.getMarkdown() || ''
        onUpdate({ editor, content, markdown })
      }
    },
    onFocus: ({ editor }) => {
      if (onFocus) {
        onFocus({ editor })
      }
    },
    onBlur: ({ editor }) => {
      if (onBlur) {
        onBlur({ editor })
      }
    },
  })

  // Expose editor methods via ref
  useImperativeHandle(ref, () => ({
    editor,
    getContent: () => editor?.getJSON() || null,
    getMarkdown: () => editor?.storage.markdown?.getMarkdown() || '',
    setContent: (newContent: JSONContent | string) => {
      if (typeof newContent === 'string') {
        editor?.commands.setContent(newContent)
      } else {
        editor?.commands.setContent(newContent)
      }
    },
    focus: () => editor?.commands.focus(),
    blur: () => editor?.commands.blur(),
    isEmpty: () => editor?.isEmpty || true,
  }))

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Update content when it changes externally
  useEffect(() => {
    if (editor && content) {
      const currentContent = JSON.stringify(editor.getJSON())
      const newContent = typeof content === 'string' ? content : JSON.stringify(content)

      if (currentContent !== newContent && typeof content !== 'string') {
        editor.commands.setContent(content, false)
      }
    }
  }, [editor, content])

  if (!editor) {
    return null
  }

  return (
    <>
      <EditorContent editor={editor} />
      {showBubbleMenu && editable && <BubbleMenu editor={editor} />}
    </>
  )
}

export const Editor = forwardRef(EditorComponent)
Editor.displayName = 'Editor'

export default Editor
