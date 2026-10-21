import { BookOpen, FileText, Layers, NotebookPen } from 'lucide-react'

import { cn } from '@/lib/utils'

export type DocumentKind = 'post' | 'chapter' | 'part' | 'note'

export const KIND_LABEL: Record<DocumentKind, string> = {
  post: 'Post',
  chapter: 'Chapter',
  part: 'Part',
  note: 'Note',
}

export function KindIcon({ kind, className }: { kind: DocumentKind | string; className?: string }) {
  const Icon =
    kind === 'note'
      ? NotebookPen
      : kind === 'chapter'
        ? BookOpen
        : kind === 'part'
          ? Layers
          : FileText
  return <Icon aria-hidden className={cn('size-4 shrink-0', className)} />
}
