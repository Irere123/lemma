import { Extension, type Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import { clsx } from 'clsx'

import { slashMenuItems, filterSlashMenuItems, type SlashMenuItem } from './items'

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export interface SlashMenuListProps {
  items: SlashMenuItem[]
  command: (item: SlashMenuItem) => void
  editor: Editor
}

export const SlashMenuList = forwardRef<SlashMenuRef, SlashMenuListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (item) {
          command(item)
        }
      },
      [items, command]
    )

    const upHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
    }, [items.length])

    const downHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev + 1) % items.length)
    }, [items.length])

    const enterHandler = useCallback(() => {
      selectItem(selectedIndex)
    }, [selectItem, selectedIndex])

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler()
          return true
        }

        if (event.key === 'ArrowDown') {
          downHandler()
          return true
        }

        if (event.key === 'Enter') {
          enterHandler()
          return true
        }

        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="slash-menu-empty">
          No results
        </div>
      )
    }

    return (
      <div className="slash-menu">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={clsx(
              'slash-menu-item',
              index === selectedIndex && 'slash-menu-item-selected'
            )}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="slash-menu-item-icon">{item.icon}</div>
            <div className="slash-menu-item-content">
              <div className="slash-menu-item-title">{item.title}</div>
              <div className="slash-menu-item-description">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    )
  }
)

SlashMenuList.displayName = 'SlashMenuList'

export interface SlashMenuSuggestionOptions {
  editor: Editor
}

function createSlashMenuSuggestion(): Omit<SuggestionOptions<SlashMenuItem>, 'editor'> {
  return {
    char: '/',
    startOfLine: false,
    items: ({ query }) => filterSlashMenuItems(query),
    render: () => {
      let component: ReactRenderer<SlashMenuRef> | null = null
      let popup: TippyInstance[] | null = null

      return {
        onStart: (props) => {
          component = new ReactRenderer(SlashMenuList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) {
            return
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            animation: 'shift-toward-subtle',
            maxWidth: 320,
          })
        },

        onUpdate: (props) => {
          component?.updateProps(props)

          if (!props.clientRect) {
            return
          }

          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          })
        },

        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }

          return component?.ref?.onKeyDown(props) || false
        },

        onExit: () => {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
    command: ({ editor, range, props }) => {
      props.command({ editor, range })
    },
  }
}

export const SlashMenuExtension = Extension.create({
  name: 'slashMenu',

  addOptions() {
    return {
      suggestion: createSlashMenuSuggestion(),
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

export { slashMenuItems, filterSlashMenuItems }
export type { SlashMenuItem }
