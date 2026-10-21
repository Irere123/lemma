import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * Typewriter scrolling (focus mode): the line being written stays at the
 * same height on screen, a little above the middle, instead of creeping
 * down to the bottom edge.
 */
export const Typewriter = Extension.create<Record<string, never>, { enabled: boolean }>({
  name: 'typewriter',

  addStorage() {
    return { enabled: false }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin({
        key: new PluginKey('typewriter'),
        view: () => ({
          update: (view, previous) => {
            if (!storage.enabled || !view.hasFocus()) return
            if (view.state.selection.eq(previous.selection) && view.state.doc.eq(previous.doc))
              return
            const { head } = view.state.selection
            let top: number
            try {
              top = view.coordsAtPos(head).top
            } catch {
              return
            }
            const target = window.innerHeight * 0.42
            const delta = top - target
            if (Math.abs(delta) > 6)
              window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior })
          },
        }),
      }),
    ]
  },
})
