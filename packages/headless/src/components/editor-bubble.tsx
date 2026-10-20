import { isNodeSelection, useCurrentEditor } from '@tiptap/react'
import { BubbleMenu, type BubbleMenuProps } from '@tiptap/react/menus'
import type { ReactNode } from 'react'
import { forwardRef, useCallback } from 'react'

export interface EditorBubbleProps extends Omit<BubbleMenuProps, 'editor'> {
  readonly children: ReactNode
}

export const EditorBubble = forwardRef<HTMLDivElement, EditorBubbleProps>(
  ({ children, ...rest }, ref) => {
    const { editor: currentEditor } = useCurrentEditor()
    // Stable across renders. Every bubble menu reacts to the same
    // `bubbleMenu` options-update transaction, which @tiptap/react sends
    // whenever shouldShow or options change identity: unstable props here
    // would overwrite other bubble menus' rules (e.g. the link bubble's).
    const shouldShow = useCallback<NonNullable<BubbleMenuProps['shouldShow']>>(
      ({ editor, state }) => {
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
      },
      []
    )

    if (!currentEditor) return null

    return (
      <div ref={ref}>
        <BubbleMenu {...rest} editor={currentEditor} shouldShow={shouldShow}>
          {children}
        </BubbleMenu>
      </div>
    )
  }
)

EditorBubble.displayName = 'EditorBubble'

export default EditorBubble
