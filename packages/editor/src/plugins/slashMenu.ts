import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

export const slashMenuPluginKey = new PluginKey('slashMenu')

export interface SlashMenuState {
  isOpen: boolean
  position: { top: number; left: number } | null
  searchTerm: string
  triggerPos: number | null
}

interface SlashMenuPluginOptions {
  onStateChange?: (state: SlashMenuState) => void
}

/**
 * Creates a plugin that detects "/" and manages slash menu state
 */
export function createSlashMenuPlugin(options: SlashMenuPluginOptions = {}): Plugin {
  const { onStateChange } = options

  return new Plugin({
    key: slashMenuPluginKey,

    state: {
      init(): SlashMenuState {
        return {
          isOpen: false,
          position: null,
          searchTerm: '',
          triggerPos: null,
        }
      },

      apply(tr, value, _oldState, newState): SlashMenuState {
        // Check for meta updates
        const meta = tr.getMeta(slashMenuPluginKey)

        // Handle explicit close
        if (meta?.close) {
          return {
            isOpen: false,
            position: null,
            searchTerm: '',
            triggerPos: null,
          }
        }

        // Handle explicit open with new state
        if (meta?.open && meta?.state) {
          return meta.state
        }

        // If menu is open, check for updates to search term
        if (value.isOpen && value.triggerPos !== null) {
          const { selection } = newState
          const cursorPos = selection.from

          // Check if cursor moved before trigger
          if (cursorPos <= value.triggerPos) {
            return {
              isOpen: false,
              position: null,
              searchTerm: '',
              triggerPos: null,
            }
          }

          // Extract search term (text after /)
          const textAfterSlash = newState.doc.textBetween(value.triggerPos + 1, cursorPos, '')

          // Check if there's a space in the search term (close menu)
          if (textAfterSlash.includes(' ') || textAfterSlash.includes('\n')) {
            return {
              isOpen: false,
              position: null,
              searchTerm: '',
              triggerPos: null,
            }
          }

          return {
            ...value,
            searchTerm: textAfterSlash,
          }
        }

        return value
      },
    },

    props: {
      handleKeyDown(view, event) {
        const state = slashMenuPluginKey.getState(view.state)

        // Handle Escape to close menu
        if (state?.isOpen && event.key === 'Escape') {
          view.dispatch(view.state.tr.setMeta(slashMenuPluginKey, { close: true }))
          return true
        }

        return false
      },

      handleTextInput(view, from, _to, text) {
        // Check for "/" trigger
        if (text === '/') {
          const { selection } = view.state
          const $from = selection.$from

          // Only trigger at start of line or after whitespace
          const charBefore = $from.parent.textContent.charAt($from.parentOffset - 1)
          if ($from.parentOffset === 0 || charBefore === ' ' || charBefore === '\n') {
            // Schedule state update after the text is inserted
            setTimeout(() => {
              const coords = view.coordsAtPos(from)
              const newState: SlashMenuState = {
                isOpen: true,
                position: {
                  top: coords.bottom + window.scrollY,
                  left: coords.left + window.scrollX,
                },
                searchTerm: '',
                triggerPos: from,
              }

              // Update plugin state
              view.dispatch(
                view.state.tr.setMeta(slashMenuPluginKey, { open: true, state: newState })
              )

              onStateChange?.(newState)
            }, 0)
          }
        }

        return false
      },
    },

    view() {
      return {
        update(view) {
          const state = slashMenuPluginKey.getState(view.state)
          if (state) {
            onStateChange?.(state)
          }
        },
      }
    },
  })
}

/**
 * Close the slash menu
 */
export function closeSlashMenu(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(slashMenuPluginKey, { close: true }))
}

/**
 * Get the current slash menu state
 */
export function getSlashMenuState(view: EditorView): SlashMenuState | undefined {
  return slashMenuPluginKey.getState(view.state)
}

/**
 * Delete the slash trigger and search term
 */
export function deleteSlashTrigger(view: EditorView): void {
  const state = getSlashMenuState(view)
  if (state?.isOpen && state.triggerPos !== null) {
    const { selection } = view.state
    const tr = view.state.tr.delete(state.triggerPos, selection.from)
    tr.setMeta(slashMenuPluginKey, { close: true })
    view.dispatch(tr)
  }
}
