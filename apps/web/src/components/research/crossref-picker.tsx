import { type Hash, Heading, Image, Sigma, Superscript, Table } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { TargetSummary } from '../editor/research'

const GROUPS: { kind: TargetSummary['kind']; title: string; icon: typeof Hash }[] = [
  { kind: 'figure', title: 'Figures', icon: Image },
  { kind: 'table', title: 'Tables', icon: Table },
  { kind: 'equation', title: 'Equations', icon: Sigma },
  { kind: 'heading', title: 'Sections', icon: Heading },
  { kind: 'footnote', title: 'Notes', icon: Superscript },
]

/**
 * Refer to a figure, table, numbered equation, section or note. The text
 * reads as the target's current label ("Figure 3") and keeps up with edits.
 */
export function CrossReferencePicker({
  open,
  targets,
  onClose,
  onPick,
}: {
  open: boolean
  targets: TargetSummary[]
  onClose: () => void
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) setQuery('')
  }, [open])
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? targets.filter((target) => `${target.label} ${target.text}`.toLowerCase().includes(needle))
    : targets
  const first = shown[0]

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className='max-w-lg' initialFocus={field}>
        <DialogHeader>
          <DialogTitle>Cross-reference</DialogTitle>
          <DialogDescription>Its number stays right as you add and move things.</DialogDescription>
        </DialogHeader>
        <DialogPanel className='flex flex-col gap-3'>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (first) onPick(first.id)
            }}
          >
            <Input
              ref={field}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder='Filter by label or caption'
              aria-label='Filter targets'
            />
          </form>
          {targets.length === 0 ? (
            <p className='rounded-lg bg-muted/60 px-3 py-4 text-[13.5px] text-muted-foreground'>
              Nothing to refer to yet. Add a caption to an image or table, number an equation, or
              add a heading.
            </p>
          ) : (
            <div className='max-h-80 overflow-y-auto'>
              {GROUPS.map((group) => {
                const items = shown.filter((target) => target.kind === group.kind)
                if (items.length === 0) return null
                const Icon = group.icon
                return (
                  <section key={group.kind} className='mb-3'>
                    <h3 className='mb-1 px-1 font-medium text-[11.5px] text-muted-foreground uppercase tracking-[0.08em]'>
                      {group.title}
                    </h3>
                    {items.map((target) => (
                      <button
                        key={target.id}
                        type='button'
                        onClick={() => onPick(target.id)}
                        className='flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent'
                      >
                        <Icon className='size-4 shrink-0 text-muted-foreground' />
                        <span className='shrink-0 font-medium text-[13.5px]'>{target.label}</span>
                        {target.text && target.kind !== 'heading' ? (
                          <span className='min-w-0 truncate text-[13px] text-muted-foreground'>
                            {target.kind === 'equation' ? (
                              <code className='font-mono text-[12px]'>{target.text}</code>
                            ) : (
                              target.text
                            )}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </section>
                )
              })}
            </div>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}
