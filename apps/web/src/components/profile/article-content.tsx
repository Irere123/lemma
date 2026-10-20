import { cn } from '@/lib/utils'

/**
 * Reader body: the HTML the server rendered from the document (escaped,
 * URL- and colour-sanitised by @lemma/content, math pre-rendered by KaTeX).
 * No editor ships to readers.
 */
export function ArticleBody({ html, className }: { html?: string | null; className?: string }) {
  return (
    <div className={cn('writer-editor', className)}>
      <div className='writer-prose' dangerouslySetInnerHTML={{ __html: html ?? '' }} />
    </div>
  )
}
