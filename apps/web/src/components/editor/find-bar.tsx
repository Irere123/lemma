import { useEditor, useEditorState } from '@lemma/headless'
import type { Editor } from '@tiptap/core'
import {
  BookOpen,
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Replace,
  WholeWord,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Tooltip, TooltipPopup, TooltipTrigger } from '../ui/tooltip'
import { findKey } from './find'

/**
 * ⌘F in the editor: find (and replace) in this document. In a chapter,
 * "Whole book" opens the same search across every chapter.
 */
export function FindBar({
  open,
  onClose,
  onWholeBook,
}: {
  open: boolean
  onClose: () => void
  onWholeBook?: () => void
}) {
  const { editor } = useEditor()
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const find = current ? findKey.getState(current.state) : null
      return { count: find?.matches.length ?? 0, current: find?.current ?? -1 }
    },
  })

  useEffect(() => {
    if (!open) return
    // Start from the selected words, if any.
    const selection = editor?.state.selection
    const selected =
      selection && !selection.empty
        ? editor.state.doc.textBetween(selection.from, selection.to, ' ')
        : ''
    if (selected && selected.length < 120) setQuery(selected)
    requestAnimationFrame(() => {
      field.current?.focus()
      field.current?.select()
    })
  }, [open, editor])

  useEffect(() => {
    if (!editor) return
    if (!open) {
      editor.commands.clearFind()
      return
    }
    editor.commands.setFind({ query, caseSensitive, wholeWord })
  }, [editor, open, query, caseSensitive, wholeWord])

  if (!open || !editor) return null
  const typed = editor as unknown as Editor
  const close = () => {
    onClose()
    typed.commands.focus()
  }
  const count = state?.count ?? 0
  const position = count === 0 ? 0 : (state?.current ?? 0) + 1

  return (
    <div
      role='search'
      aria-label='Find in document'
      className='fixed top-16 right-4 z-40 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border/80 bg-popover p-2 shadow-raised'
    >
      <div className='flex items-center gap-1'>
        <Button
          variant='ghost'
          size='icon-xs'
          aria-label={replacing ? 'Hide replace' : 'Show replace'}
          aria-expanded={replacing}
          onClick={() => setReplacing((value) => !value)}
        >
          <Replace />
        </Button>
        <input
          ref={field}
          value={query}
          aria-label='Find'
          placeholder='Find'
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              typed.commands.findStep(event.shiftKey ? -1 : 1)
            }
            if (event.key === 'Escape') close()
          }}
          className='h-8 min-w-0 flex-1 rounded-md bg-muted/60 px-2 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring'
        />
        <span
          className='w-14 shrink-0 text-center text-[12px] text-muted-foreground tabular-nums'
          aria-live='polite'
        >
          {query ? `${position} of ${count}` : ''}
        </span>
        <Toggle
          label='Match case'
          pressed={caseSensitive}
          onToggle={() => setCaseSensitive((value) => !value)}
        >
          <CaseSensitive />
        </Toggle>
        <Toggle
          label='Whole words'
          pressed={wholeWord}
          onToggle={() => setWholeWord((value) => !value)}
        >
          <WholeWord />
        </Toggle>
        <Button
          variant='ghost'
          size='icon-xs'
          aria-label='Previous match'
          disabled={count === 0}
          onClick={() => typed.commands.findStep(-1)}
        >
          <ChevronUp />
        </Button>
        <Button
          variant='ghost'
          size='icon-xs'
          aria-label='Next match'
          disabled={count === 0}
          onClick={() => typed.commands.findStep(1)}
        >
          <ChevronDown />
        </Button>
        <Button variant='ghost' size='icon-xs' aria-label='Close find' onClick={close}>
          <X />
        </Button>
      </div>
      {replacing ? (
        <div className='mt-1.5 flex items-center gap-1 pl-7'>
          <input
            value={replacement}
            aria-label='Replace with'
            placeholder='Replace with'
            onChange={(event) => setReplacement(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                typed.commands.replaceCurrent(replacement)
              }
              if (event.key === 'Escape') close()
            }}
            className='h-8 min-w-0 flex-1 rounded-md bg-muted/60 px-2 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring'
          />
          <Button
            variant='ghost'
            size='xs'
            disabled={count === 0}
            onClick={() => typed.commands.replaceCurrent(replacement)}
          >
            Replace
          </Button>
          <Button
            variant='ghost'
            size='xs'
            disabled={count === 0}
            onClick={() => typed.commands.replaceAllMatches(replacement)}
          >
            All
          </Button>
        </div>
      ) : null}
      {onWholeBook ? (
        <button
          type='button'
          onClick={onWholeBook}
          className='mt-1.5 ml-7 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground'
        >
          <BookOpen className='size-3.5' /> Find and replace in the whole book
        </button>
      ) : null}
    </div>
  )
}

function Toggle({
  label,
  pressed,
  onToggle,
  children,
}: {
  label: string
  pressed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type='button'
            aria-label={label}
            aria-pressed={pressed}
            onClick={onToggle}
            className={cn(
              'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-6 [&_svg]:size-4',
              pressed && 'bg-brand-soft text-brand'
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  )
}
