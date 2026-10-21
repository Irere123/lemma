import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type DocumentKind, KindIcon } from './kind'

/** The content column of a workspace page. */
export function Page({
  children,
  className,
  wide = false,
}: {
  children: ReactNode
  className?: string
  wide?: boolean
}) {
  return (
    <section
      className={cn(
        'mx-auto w-full px-5 pt-8 pb-24 md:px-10 md:pt-12',
        wide ? 'max-w-6xl' : 'max-w-4xl',
        className
      )}
    >
      {children}
    </section>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
}) {
  return (
    <header className='mb-8 flex flex-wrap items-end justify-between gap-4'>
      <div className='min-w-0'>
        {eyebrow ? <p className='mb-1.5 text-[13px] text-muted-foreground'>{eyebrow}</p> : null}
        <h1 className='font-semibold text-[1.75rem] text-foreground leading-tight tracking-tight'>
          {title}
        </h1>
        {description ? (
          <p className='mt-1.5 max-w-prose text-[15px] text-muted-foreground'>{description}</p>
        ) : null}
      </div>
      {actions ? <div className='flex shrink-0 items-center gap-2'>{actions}</div> : null}
    </header>
  )
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className='mb-3 flex items-center justify-between gap-3'>
      <h2 className='font-medium text-[13px] text-muted-foreground uppercase tracking-[0.08em]'>
        {children}
      </h2>
      {action}
    </div>
  )
}

export type DocumentRowItem = {
  id: string
  title: string | null
  kind: DocumentKind | string
  status?: string | null
  excerpt?: string | null
  wordCount?: string | number | null
  updatedAt?: Date | string | null
  scheduledDate?: Date | string | null
}

export function StatusPill({ status, scheduled }: { status?: string | null; scheduled?: boolean }) {
  if (status === 'PUBLISHED')
    return (
      <span className='inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 font-medium text-[11.5px] text-success-foreground'>
        <span className='size-1.5 rounded-full bg-success' />
        Published
      </span>
    )
  if (scheduled)
    return (
      <span className='inline-flex items-center gap-1.5 rounded-full bg-info/10 px-2 py-0.5 font-medium text-[11.5px] text-info-foreground'>
        <span className='size-1.5 rounded-full bg-info' />
        Scheduled
      </span>
    )
  return (
    <span className='inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-medium text-[11.5px] text-muted-foreground'>
      <span className='size-1.5 rounded-full bg-muted-foreground/50' />
      Draft
    </span>
  )
}

/** One document in a list: title, a line of its text, status and when it was edited. */
export function DocumentRow({
  doc,
  showKind = false,
  showStatus = true,
  trailing,
}: {
  doc: DocumentRowItem
  showKind?: boolean
  showStatus?: boolean
  trailing?: ReactNode
}) {
  const words = Number(doc.wordCount) || 0
  return (
    <li className='group/doc relative'>
      <Link
        to='/write/$docId'
        params={{ docId: doc.id }}
        className='-mx-3 flex items-start gap-3 rounded-lg px-3 py-3 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring'
      >
        {showKind ? <KindIcon kind={doc.kind} className='mt-0.5 text-muted-foreground' /> : null}
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='truncate font-medium text-[15px] text-foreground'>
              {doc.title?.trim() || 'Untitled'}
            </span>
          </div>
          {doc.excerpt ? (
            <p className='mt-0.5 line-clamp-1 text-[13.5px] text-muted-foreground'>{doc.excerpt}</p>
          ) : null}
        </div>
        <div className='flex shrink-0 items-center gap-3 pt-0.5 text-[12.5px] text-muted-foreground tabular-nums'>
          {showStatus && doc.kind !== 'note' ? (
            <StatusPill
              status={doc.status}
              scheduled={Boolean(doc.scheduledDate) && doc.status !== 'PUBLISHED'}
            />
          ) : null}
          <span className='hidden w-16 text-right sm:inline'>
            {words > 0 ? `${words.toLocaleString()} w` : '—'}
          </span>
          <span className='w-20 text-right'>{relativeTime(doc.updatedAt)}</span>
        </div>
      </Link>
      {trailing ? (
        <div className='-translate-y-1/2 absolute top-1/2 right-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/doc:opacity-100'>
          {trailing}
        </div>
      ) : null}
    </li>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className='flex flex-col items-center rounded-2xl border border-border border-dashed px-6 py-14 text-center'>
      <div className='mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-5'>
        {icon}
      </div>
      <p className='font-medium text-[15px] text-foreground'>{title}</p>
      <p className='mt-1 max-w-sm text-[13.5px] text-muted-foreground'>{description}</p>
      {action ? <div className='mt-5'>{action}</div> : null}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className='flex flex-col'>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className='flex items-center gap-3 py-3.5'>
          <div
            className='h-4 flex-1 animate-pulse rounded bg-muted'
            style={{ maxWidth: `${60 - index * 5}%` }}
          />
          <div className='h-3 w-16 animate-pulse rounded bg-muted' />
        </li>
      ))}
    </ul>
  )
}
