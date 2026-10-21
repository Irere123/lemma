import katex from 'katex'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '../ui/dialog'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'

export type MathEdit = {
  latex: string
  pos: number
  display: boolean
  /** A new equation: inserted at `pos` on save, nothing on cancel. */
  isNew?: boolean
  /** Display equations only: shown with "(n)" and can be cross-referenced. */
  numbered?: boolean
}

type MathDialogProps = {
  edit: MathEdit | null
  onClose: () => void
  onSave: (edit: MathEdit, latex: string, numbered: boolean) => void
  onDelete: (edit: MathEdit) => void
}

/** Edit an equation's LaTeX with a live preview. */
export function MathDialog({ edit, onClose, onSave, onDelete }: MathDialogProps) {
  const [latex, setLatex] = useState('')
  const [numbered, setNumbered] = useState(false)

  useEffect(() => {
    if (!edit) return
    setLatex(edit.latex)
    setNumbered(edit.numbered === true)
  }, [edit])

  const preview = useMemo(() => {
    try {
      return {
        html: katex.renderToString(latex || '\\;', {
          displayMode: edit?.display ?? false,
          throwOnError: true,
        }),
        error: null,
      }
    } catch (error) {
      return {
        html: null,
        error:
          error instanceof Error
            ? error.message.replace(/^KaTeX parse error: /, '')
            : 'Invalid LaTeX',
      }
    }
  }, [latex, edit?.display])

  const save = () => {
    if (!edit) return
    if (latex.trim()) onSave(edit, latex.trim(), numbered)
    else onDelete(edit)
  }

  return (
    <Dialog open={edit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>{edit?.display ? 'Equation' : 'Inline equation'}</DialogTitle>
          <DialogDescription>Write LaTeX. ⌘↵ to save.</DialogDescription>
        </DialogHeader>
        <DialogPanel className='space-y-3'>
          <Textarea
            aria-label='LaTeX'
            autoFocus
            spellCheck={false}
            className='font-mono text-sm'
            value={latex}
            onChange={(event) => setLatex(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                save()
              }
            }}
          />
          <div className='min-h-12 overflow-x-auto rounded-lg border border-border/70 bg-muted/40 px-3 py-2'>
            {preview.html ? (
              <div dangerouslySetInnerHTML={{ __html: preview.html }} />
            ) : (
              <p className='text-destructive text-xs'>{preview.error}</p>
            )}
          </div>
          {edit?.display ? (
            <Label className='flex items-center gap-2 font-normal text-[13px] text-muted-foreground'>
              <Checkbox
                checked={numbered}
                onCheckedChange={(value) => setNumbered(value === true)}
              />
              Number this equation, so it can be referred to as “Eq. (n)”
            </Label>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button type='button' variant='ghost' onClick={() => edit && onDelete(edit)}>
            {edit?.isNew ? 'Cancel' : 'Remove'}
          </Button>
          <Button type='button' onClick={save} disabled={edit?.isNew && !latex.trim()}>
            {edit?.isNew ? 'Insert' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
