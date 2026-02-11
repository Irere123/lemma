import { isNodeSelection, useCurrentEditor } from '@tiptap/react'
import { BubbleMenu, type BubbleMenuProps } from '@tiptap/react/menus'
import type { ReactNode } from 'react'
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import type { Instance, Props } from 'tippy.js'

export interface EditorBubbleProps extends Omit<BubbleMenuProps, 'editor'> {
  readonly children: ReactNode
}

export const EditorBubble = forwardRef<HTMLDivElement, EditorBubbleProps>(
  ({ children, ...rest }, ref) => {
    const { editor: currentEditor } = useCurrentEditor()
    const instanceRef = useRef<Instance<Props> | null>(null)

    useEffect(() => {
      if (!instanceRef.current) return

      instanceRef.current.popperInstance?.update()
    }, [])

    const bubbleMenuProps: Omit<BubbleMenuProps, 'children'> = useMemo(() => {
      const shouldShow: BubbleMenuProps['shouldShow'] = ({ editor, state }) => {
        const { selection } = state
        const { empty } = selection

        // don't show bubble menu if:
        // - the editor is not editable
        // - the selected node is an image
        // - the selection is empty
        // - the selection is a node selection (for drag handles)
        if (
          !editor?.isEditable ||
          editor?.isActive('image') ||
          empty ||
          isNodeSelection(selection)
        ) {
          return false
        }
        return true
      }

      const editor = currentEditor ?? undefined

      return {
        shouldShow,
        onCreate: (val: Instance<Props>) => {
          instanceRef.current = val

          instanceRef.current.popper.firstChild?.addEventListener('blur', (event) => {
            event.preventDefault()
            event.stopImmediatePropagation()
          })
        },
        editor,
        ...rest,
      }
    }, [currentEditor, rest])

    if (!currentEditor) return null

    return (
      <div ref={ref}>
        <BubbleMenu {...bubbleMenuProps}>{children}</BubbleMenu>
      </div>
    )
  }
)

EditorBubble.displayName = 'EditorBubble'

export default EditorBubble
