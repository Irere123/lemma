import type { CslItem, CslName } from '@lemma/content/citations'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatReference } from '@/lib/research/format'
import { useTRPC } from '@/trpc/client'

const TYPES: { value: string; label: string }[] = [
  { value: 'article-journal', label: 'Journal article' },
  { value: 'book', label: 'Book' },
  { value: 'chapter', label: 'Book chapter' },
  { value: 'paper-conference', label: 'Conference paper' },
  { value: 'article', label: 'Preprint' },
  { value: 'report', label: 'Report' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'webpage', label: 'Web page' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'software', label: 'Software' },
]

const nameLine = (name: CslName) =>
  name.literal ?? [name.family, name.given].filter(Boolean).join(', ')

function parseNames(text: string): CslName[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // "Family, Given" — or a single name like an organisation, kept whole.
      const comma = line.indexOf(',')
      if (comma === -1) return line.includes(' ') ? splitPlain(line) : { literal: line }
      return { family: line.slice(0, comma).trim(), given: line.slice(comma + 1).trim() }
    })
}

function splitPlain(line: string): CslName {
  const parts = line.split(/\s+/)
  const family = parts.pop() ?? line
  return { family, given: parts.join(' ') }
}

type Form = {
  key: string
  type: string
  title: string
  authors: string
  editors: string
  year: string
  container: string
  volume: string
  issue: string
  page: string
  publisher: string
  place: string
  doi: string
  url: string
  isbn: string
}

function toForm(key: string, csl: CslItem): Form {
  return {
    key,
    type: csl.type ?? 'article-journal',
    title: csl.title ?? '',
    authors: (csl.author ?? []).map(nameLine).join('\n'),
    editors: (csl.editor ?? []).map(nameLine).join('\n'),
    year: String(csl.issued?.['date-parts']?.[0]?.[0] ?? ''),
    container: csl['container-title'] ?? '',
    volume: String(csl.volume ?? ''),
    issue: String(csl.issue ?? ''),
    page: String(csl.page ?? ''),
    publisher: csl.publisher ?? '',
    place: csl['publisher-place'] ?? '',
    doi: csl.DOI ?? '',
    url: csl.URL ?? '',
    isbn: csl.ISBN ?? '',
  }
}

function toCsl(id: string, form: Form, base: CslItem): CslItem {
  const year = Number(form.year)
  const optional = (value: string) => value.trim() || undefined
  return {
    ...base,
    id,
    type: form.type as CslItem['type'],
    title: optional(form.title),
    author: parseNames(form.authors),
    editor: parseNames(form.editors),
    issued: Number.isFinite(year) && year > 0 ? { 'date-parts': [[year]] } : undefined,
    'container-title': optional(form.container),
    volume: optional(form.volume),
    issue: optional(form.issue),
    page: optional(form.page),
    publisher: optional(form.publisher),
    'publisher-place': optional(form.place),
    DOI: optional(form.doi),
    URL: optional(form.url),
    ISBN: optional(form.isbn),
  }
}

/** Edit a reference's fields (or add one by hand), with a live preview. */
export function ReferenceEditor({
  value,
  onClose,
  onSaved,
}: {
  value: { id: string | null; key: string; csl: CslItem } | null
  onClose: () => void
  onSaved: () => void
}) {
  const trpc = useTRPC()
  const [form, setForm] = useState<Form | null>(null)
  useEffect(() => {
    if (value) setForm(toForm(value.key, value.csl))
  }, [value])
  const onError = (error: { message: string }) => toast.error(error.message)
  const update = useMutation(
    trpc.references.update.mutationOptions({ onSuccess: onSaved, onError })
  )
  const create = useMutation(
    trpc.references.create.mutationOptions({ onSuccess: onSaved, onError })
  )

  const field = (
    name: keyof Form,
    label: string,
    props: { placeholder?: string; className?: string } = {}
  ) => (
    <div className={props.className}>
      <Label htmlFor={`ref-${name}`} className='mb-1.5 block text-[12.5px] text-muted-foreground'>
        {label}
      </Label>
      <Input
        id={`ref-${name}`}
        value={form?.[name] ?? ''}
        placeholder={props.placeholder}
        onChange={(event) => {
          const next = event.currentTarget.value
          setForm((current) => (current ? { ...current, [name]: next } : current))
        }}
      />
    </div>
  )

  const csl = form && value ? toCsl(value.id ?? 'preview', form, value.csl) : null
  const preview = csl ? formatReference(csl, 'apa') : null
  const saving = update.isPending || create.isPending

  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className='max-w-2xl'>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!csl || !value || !form) return
            if (value.id) update.mutate({ id: value.id, csl, key: form.key.trim() || undefined })
            else create.mutate({ csl })
          }}
        >
          <DialogHeader>
            <DialogTitle>{value?.id ? 'Edit reference' : 'Add a reference'}</DialogTitle>
            <DialogDescription>
              Authors one per line, as “Family, Given”. Changes reach every citation of it.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className='grid grid-cols-6 gap-3'>
            <div className='col-span-6 sm:col-span-3'>
              <Label
                htmlFor='ref-type'
                className='mb-1.5 block text-[12.5px] text-muted-foreground'
              >
                Type
              </Label>
              <select
                id='ref-type'
                value={form?.type ?? 'article-journal'}
                onChange={(event) => {
                  const next = event.currentTarget.value
                  setForm((current) => (current ? { ...current, type: next } : current))
                }}
                className='h-9 w-full rounded-lg border border-input bg-background px-2.5 text-[14px] shadow-xs/5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8'
              >
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            {value?.id
              ? field('key', 'Citation key', { className: 'col-span-6 sm:col-span-3' })
              : null}
            {field('title', 'Title', { className: 'col-span-6' })}
            <div className='col-span-6 sm:col-span-3'>
              <Label
                htmlFor='ref-authors'
                className='mb-1.5 block text-[12.5px] text-muted-foreground'
              >
                Authors
              </Label>
              <Textarea
                id='ref-authors'
                rows={3}
                value={form?.authors ?? ''}
                placeholder={'Smith, Jane\nOkafor, Chidi'}
                onChange={(event) => {
                  const next = event.currentTarget.value
                  setForm((current) => (current ? { ...current, authors: next } : current))
                }}
              />
            </div>
            <div className='col-span-6 sm:col-span-3'>
              <Label
                htmlFor='ref-editors'
                className='mb-1.5 block text-[12.5px] text-muted-foreground'
              >
                Editors
              </Label>
              <Textarea
                id='ref-editors'
                rows={3}
                value={form?.editors ?? ''}
                onChange={(event) => {
                  const next = event.currentTarget.value
                  setForm((current) => (current ? { ...current, editors: next } : current))
                }}
              />
            </div>
            {field('year', 'Year', { className: 'col-span-2' })}
            {field('container', 'Journal, book or site', { className: 'col-span-4' })}
            {field('volume', 'Volume', { className: 'col-span-2' })}
            {field('issue', 'Issue', { className: 'col-span-2' })}
            {field('page', 'Pages', { className: 'col-span-2', placeholder: '45–67' })}
            {field('publisher', 'Publisher', { className: 'col-span-3' })}
            {field('place', 'Place', { className: 'col-span-3' })}
            {field('doi', 'DOI', { className: 'col-span-3', placeholder: '10.1000/xyz123' })}
            {field('isbn', 'ISBN', { className: 'col-span-3' })}
            {field('url', 'URL', { className: 'col-span-6' })}
            {preview?.html ? (
              <div className='col-span-6 rounded-lg bg-muted/60 px-3 py-2.5'>
                <p className='mb-1 text-[11.5px] text-muted-foreground uppercase tracking-[0.08em]'>
                  Preview (APA)
                </p>
                <p
                  className='font-serif text-[14.5px] leading-relaxed'
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </div>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button type='button' variant='ghost' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={saving}>
              {saving ? <Loader2 className='animate-spin' /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
