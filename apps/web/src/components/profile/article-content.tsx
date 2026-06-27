import { EditorContent, EditorRoot } from '@lemma/headless'

import { defaultExtensions } from '@/components/editor/extensions'
import { cn } from '@/lib/utils'

/**
 * Read-only renderer for a published document's stored markdown. Reuses the
 * editor's extension set (including the markdown parser and custom blocks) with
 * editing disabled, so reader output matches what authors see while writing.
 */
export function ArticleContent({ markdown, className }: { markdown: string; className?: string }) {
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

/**
 * Reader body: render the server-built `html` (no editor on the read path),
 * falling back to the read-only editor over legacy `markdown`.
 */
export function ArticleBody({
  html,
  markdown,
  className,
}: {
  html?: string | null
  markdown?: string | null
  className?: string
}) {
  if (html && html.trim().length > 0) {
    return (
      <div className={cn('writer-editor', className)}>
        {/* Safe: html is built server-side by @lemma/content (escaped + URL-sanitized). */}
        <div className='writer-prose' dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    )
  }

  return <ArticleContent markdown={markdown ?? ''} className={className} />
}
