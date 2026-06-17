import { EditorContent, EditorRoot } from '@lemma/headless'

import { defaultExtensions } from '@/components/editor/extensions'
import { cn } from '@/lib/utils'

/**
 * Read-only renderer for a published document's stored markdown. Reuses the
 * editor's extension set (including the markdown parser and custom blocks) with
 * editing disabled, so reader output matches what authors see while writing.
 */
export function ArticleContent({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) {
  return (
    <EditorRoot>
      <EditorContent
        initialContent={markdown}
        extensions={defaultExtensions as never}
        immediatelyRender={false}
        editable={false}
        className={cn('writer-editor', className)}
        editorProps={{
          attributes: {
            class: 'writer-prose focus:outline-none',
          },
        }}
      />
    </EditorRoot>
  )
}
