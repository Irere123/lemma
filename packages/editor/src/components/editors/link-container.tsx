import type { Editor } from '@tiptap/core'

import { LinkViewContainer } from './link-view-container'

export function LinkContainer({
  editor,
  containerRef,
}: {
  editor: Editor
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <LinkViewContainer editor={editor} containerRef={containerRef} />
    </>
  )
}
