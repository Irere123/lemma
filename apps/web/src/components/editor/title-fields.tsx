import type { KeyboardEvent, RefObject } from 'react'
import { memo, useCallback, useLayoutEffect } from 'react'
import type { UndoManager } from 'yjs'

import type { DocumentSync } from '@/lib/collab/document-sync'
import { useYText } from '@/lib/collab/hooks'

type Field = HTMLTextAreaElement

// Grow a textarea with its content (field-sizing where supported, else by hand).
function autosize(field: Field | null) {
  if (!field || CSS.supports('field-sizing', 'content')) return
  field.style.height = 'auto'
  field.style.height = `${field.scrollHeight}px`
}

const atStart = (field: Field) => field.selectionStart === 0 && field.selectionEnd === 0
const atEnd = (field: Field) =>
  field.selectionStart === field.value.length && field.selectionEnd === field.value.length

/**
 * Title and subtitle: part of the page, not a form above it. Enter and the
 * arrow keys move between them and the body as if they were its first lines.
 * In their own component so typing in them doesn't re-render the editor.
 */
export const TitleFields = memo(function TitleFields({
  sync,
  undoManager,
  disabled,
  titleRef,
  subtitleRef,
  onExitToBody,
}: {
  sync: DocumentSync
  undoManager: UndoManager
  disabled: boolean
  titleRef: RefObject<Field | null>
  subtitleRef: RefObject<Field | null>
  /** Move the caret into the body (at its start). */
  onExitToBody: () => void
}) {
  const [title, setTitle] = useYText(sync.title)
  const [subtitle, setSubtitle] = useYText(sync.subtitle)

  useLayoutEffect(() => autosize(titleRef.current), [title, titleRef])
  useLayoutEffect(() => autosize(subtitleRef.current), [subtitle, subtitleRef])

  // ⌘Z / ⇧⌘Z / ⌘Y use the document's history, not the field's own (which
  // knows nothing about the body).
  const undoKeys = useCallback(
    (event: KeyboardEvent<Field>) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return false
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) undoManager.undo()
      else if ((key === 'z' && event.shiftKey) || key === 'y') undoManager.redo()
      else return false
      event.preventDefault()
      return true
    },
    [undoManager]
  )

  const onTitleKeyDown = useCallback(
    (event: KeyboardEvent<Field>) => {
      if (undoKeys(event) || event.nativeEvent.isComposing) return
      const field = event.currentTarget
      if (event.key === 'Enter' || (event.key === 'ArrowDown' && atEnd(field))) {
        event.preventDefault()
        subtitleRef.current?.focus()
        subtitleRef.current?.setSelectionRange(0, 0)
      }
    },
    [subtitleRef, undoKeys]
  )

  const onSubtitleKeyDown = useCallback(
    (event: KeyboardEvent<Field>) => {
      if (undoKeys(event) || event.nativeEvent.isComposing) return
      const field = event.currentTarget
      if (
        (event.key === 'Enter' && !event.shiftKey) ||
        (event.key === 'ArrowDown' && atEnd(field))
      ) {
        event.preventDefault()
        onExitToBody()
      } else if (
        (event.key === 'ArrowUp' && atStart(field)) ||
        (event.key === 'Backspace' && field.value === '')
      ) {
        event.preventDefault()
        const titleField = titleRef.current
        titleField?.focus()
        titleField?.setSelectionRange(titleField.value.length, titleField.value.length)
      }
    },
    [onExitToBody, titleRef, undoKeys]
  )

  // Moving between fields starts a new undo step.
  const onFocus = useCallback(() => undoManager.stopCapturing(), [undoManager])

  return (
    <div className='mb-6 space-y-2'>
      <textarea
        ref={titleRef}
        rows={1}
        aria-label='Document title'
        className='block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-semibold text-4xl text-foreground leading-[1.12] tracking-tight [field-sizing:content] placeholder:text-muted-foreground/45 focus:outline-none md:text-[2.75rem]'
        placeholder='Title'
        value={title}
        disabled={disabled}
        onChange={(event) => setTitle(event.currentTarget.value.replace(/\n/g, ' '))}
        onKeyDown={onTitleKeyDown}
        onFocus={onFocus}
      />
      <textarea
        ref={subtitleRef}
        rows={1}
        aria-label='Document subtitle'
        className='block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-lg text-muted-foreground leading-relaxed [field-sizing:content] placeholder:text-muted-foreground/45 focus:outline-none md:text-xl'
        placeholder='Add a subtitle'
        value={subtitle}
        disabled={disabled}
        onChange={(event) => setSubtitle(event.currentTarget.value)}
        onKeyDown={onSubtitleKeyDown}
        onFocus={onFocus}
      />
    </div>
  )
})
