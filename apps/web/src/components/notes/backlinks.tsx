import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Link2, Quote } from 'lucide-react'

import { KindIcon } from '@/components/workspace/kind'
import { useTRPC } from '@/trpc/client'

/**
 * Under a note: every document linking to it, with the sentence around each
 * link, and documents that mention its title without linking it yet.
 */
export function Backlinks({ documentId }: { documentId: string }) {
  const trpc = useTRPC()
  const { data } = useQuery({
    ...trpc.notes.backlinks.queryOptions({ id: documentId }),
    refetchInterval: 30_000,
  })
  const links = data?.links ?? []
  const mentions = data?.mentions ?? []

  return (
    <section
      aria-label='Links to this note'
      className='backlinks mt-16 border-border/70 border-t pt-6 font-sans'
    >
      <h2 className='mb-3 flex items-center gap-2 font-medium text-[13px] text-muted-foreground uppercase tracking-[0.08em]'>
        <Link2 className='size-3.5' /> Linked from{' '}
        {links.length > 0 ? <span className='tabular-nums'>{links.length}</span> : null}
      </h2>
      {links.length === 0 ? (
        <p className='text-[13.5px] text-muted-foreground'>
          Nothing links here yet. Type <span className='font-mono text-[12.5px]'>[[</span> in
          another note to link to this one.
        </p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {links.map((link, index) => (
            <li key={`${link.sourceId}-${index}`}>
              <Link
                to='/write/$docId'
                params={{ docId: link.sourceId }}
                hash={link.blockId ?? undefined}
                className='block rounded-lg bg-card px-3.5 py-2.5 shadow-surface outline-none transition-shadow hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring'
              >
                <span className='flex items-center gap-1.5 font-medium text-[13.5px] text-foreground'>
                  <KindIcon kind={link.kind} className='size-3.5 text-muted-foreground' />
                  {link.title?.trim() || 'Untitled'}
                </span>
                {link.context ? (
                  <span className='mt-1 block line-clamp-2 font-serif text-[14px] text-muted-foreground leading-relaxed'>
                    {link.context}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {mentions.length > 0 ? (
        <>
          <h2 className='mt-6 mb-3 flex items-center gap-2 font-medium text-[13px] text-muted-foreground uppercase tracking-[0.08em]'>
            <Quote className='size-3.5' /> Mentioned in{' '}
            <span className='tabular-nums'>{mentions.length}</span>
          </h2>
          <ul className='flex flex-col gap-2'>
            {mentions.map((mention) => (
              <li key={mention.documentId}>
                <Link
                  to='/write/$docId'
                  params={{ docId: mention.documentId }}
                  className='block rounded-lg px-3.5 py-2 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring'
                >
                  <span className='flex items-center gap-1.5 font-medium text-[13.5px] text-foreground'>
                    <KindIcon kind={mention.kind} className='size-3.5 text-muted-foreground' />
                    {mention.title?.trim() || 'Untitled'}
                  </span>
                  {mention.context ? (
                    <span className='mt-0.5 block line-clamp-2 font-serif text-[14px] text-muted-foreground'>
                      {mention.context}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
