import { ReactRenderer } from '@lemma/headless'
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'
import { BookOpen, FileText, NotebookPen, Plus } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

export type LinkableDocument = { id: string; title: string | null; kind: string }

export type DocLinkOptions = {
  /** Documents to offer, best first, for what's been typed after [[. */
  search: (query: string) => Promise<LinkableDocument[]> | LinkableDocument[]
  /** Make a new note with this title and return it (its id may be chosen on the device). */
  createNote: (title: string) => LinkableDocument
}

const KIND_ICON = { note: NotebookPen, chapter: BookOpen, post: FileText } as const

type Item = { kind: 'existing'; doc: LinkableDocument } | { kind: 'create'; title: string }

type ListHandle = { onKeyDown: (event: KeyboardEvent) => boolean }

const DocLinkList = forwardRef<
  ListHandle,
  { items: Item[]; command: (item: Item) => void; query: string }
>(function DocLinkList({ items, command, query }, ref) {
  const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [items])
  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === 'ArrowDown') {
        setSelected((index) => (index + 1) % Math.max(1, items.length))
        return true
      }
      if (event.key === 'ArrowUp') {
        setSelected((index) => (index - 1 + items.length) % Math.max(1, items.length))
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[selected]
        if (item) command(item)
        return Boolean(item)
      }
      return false
    },
  }))
  return (
    <div
      role='listbox'
      aria-label='Link to a document'
      className='z-50 w-80 overflow-hidden rounded-xl border border-border/80 bg-popover p-1 shadow-raised'
    >
      {items.length === 0 ? (
        <p className='px-3 py-4 text-center text-[13px] text-muted-foreground'>
          {query ? 'Nothing found' : 'Type a title'}
        </p>
      ) : (
        items.map((item, index) => {
          const Icon =
            item.kind === 'create'
              ? Plus
              : (KIND_ICON[item.doc.kind as keyof typeof KIND_ICON] ?? FileText)
          return (
            <button
              key={item.kind === 'create' ? 'create' : item.doc.id}
              type='button'
              role='option'
              aria-selected={index === selected}
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(event) => {
                event.preventDefault()
                command(item)
              }}
              className='flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[14px] aria-selected:bg-accent'
            >
              <Icon className='size-4 shrink-0 text-muted-foreground' />
              <span className='min-w-0 flex-1 truncate'>
                {item.kind === 'create' ? (
                  <>
                    New note “<span className='font-medium'>{item.title}</span>”
                  </>
                ) : (
                  item.doc.title?.trim() || 'Untitled'
                )}
              </span>
            </button>
          )
        })
      )}
    </div>
  )
})

const docLinkKey = new PluginKey('docLinkSuggestion')

/**
 * [[ opens a picker of the writer's documents; choosing one inserts a link
 * that holds its id (so renaming it never breaks the link). A title that
 * doesn't exist yet can be created as a note on the spot.
 */
export const DocLinkSuggestion = Extension.create<DocLinkOptions>({
  name: 'docLinkSuggestion',

  addOptions() {
    return {
      search: () => [],
      createNote: (title) => ({ id: '', title, kind: 'note' }),
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      Suggestion<Item>({
        editor: this.editor,
        pluginKey: docLinkKey,
        char: '[[',
        allowSpaces: true,
        startOfLine: false,
        // Not inside code, where [[ is just text.
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          return (
            !$from.parent.type.spec.code && !$from.marks().some((mark) => mark.type.name === 'code')
          )
        },
        items: async ({ query }) => {
          const title = query.replace(/\]+$/, '').trim()
          const found = await options.search(title)
          const exact = found.some(
            (doc) => (doc.title ?? '').trim().toLowerCase() === title.toLowerCase()
          )
          const items: Item[] = found.slice(0, 8).map((doc) => ({ kind: 'existing', doc }))
          if (title && !exact) items.push({ kind: 'create', title })
          return items
        },
        command: ({ editor, range, props: item }) => {
          const doc = item.kind === 'create' ? options.createNote(item.title) : item.doc
          if (!doc.id) return
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: 'documentLink',
                attrs: { documentId: doc.id, blockId: null, title: doc.title ?? '' },
              },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        render: () => {
          let component: ReactRenderer<ListHandle> | null = null
          let wrapper: HTMLDivElement | null = null
          const place = (props: SuggestionProps<Item>) => {
            const rect = props.clientRect?.()
            if (!wrapper || !rect) return
            const below = rect.bottom + 6
            const fitsBelow = below + 320 < window.innerHeight
            wrapper.style.left = `${Math.min(rect.left, window.innerWidth - 336)}px`
            wrapper.style.top = fitsBelow ? `${below}px` : ''
            wrapper.style.bottom = fitsBelow ? '' : `${window.innerHeight - rect.top + 6}px`
          }
          return {
            onStart: (props) => {
              wrapper = document.createElement('div')
              wrapper.style.position = 'fixed'
              wrapper.style.zIndex = '60'
              document.body.appendChild(wrapper)
              component = new ReactRenderer(DocLinkList, {
                props: { items: props.items, command: props.command, query: props.query },
                editor: props.editor as unknown as ConstructorParameters<
                  typeof ReactRenderer
                >[1]['editor'],
              })
              wrapper.appendChild(component.element)
              place(props)
            },
            onUpdate: (props) => {
              component?.updateProps({
                items: props.items,
                command: props.command,
                query: props.query,
              })
              place(props)
            },
            onKeyDown: ({ event }) => {
              if (event.key === 'Escape') {
                wrapper?.remove()
                return true
              }
              return component?.ref?.onKeyDown(event) ?? false
            },
            onExit: () => {
              component?.destroy()
              wrapper?.remove()
              component = null
              wrapper = null
            },
          }
        },
      }),
    ]
  },
})
