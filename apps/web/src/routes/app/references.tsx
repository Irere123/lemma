import type { CslItem } from '@lemma/content/citations'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  Download,
  FileUp,
  Library,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ReferenceEditor } from '@/components/research/reference-editor'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { EmptyState, ListSkeleton, Page, PageHeader } from '@/components/workspace/page'
import { downloadText } from '@/lib/export/download'
import { formatReference, referenceSearchText } from '@/lib/research/format'
import { useTRPC, useTRPCClient } from '@/trpc/client'

export const Route = createFileRoute('/app/references')({
  component: References,
})

function References() {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const queryClient = useQueryClient()
  const { data: library, isLoading } = useQuery(trpc.references.list.queryOptions())
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState('')
  const [editing, setEditing] = useState<{ id: string | null; key: string; csl: CslItem } | null>(
    null
  )
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: trpc.references.list.queryKey() })
  const fail = (error: { message: string }) => toast.error(error.message)
  const add = useMutation(
    trpc.references.addByIdentifier.mutationOptions({
      onSuccess: ({ duplicate, item }) => {
        setLookup('')
        refresh()
        toast.success(duplicate ? 'Already in your library' : 'Added to your library', {
          description: item ? formatReference(item.csl, 'apa').text : undefined,
        })
      },
      onError: fail,
    })
  )
  const importFile = useMutation(
    trpc.references.import.mutationOptions({
      onSuccess: ({ added, duplicates, format, warnings }) => {
        refresh()
        toast.success(
          `Imported ${added} ${added === 1 ? 'reference' : 'references'} from ${format}`,
          {
            description:
              [
                duplicates ? `${duplicates} already in your library` : null,
                warnings.length ? `${warnings.length} skipped or adjusted` : null,
              ]
                .filter(Boolean)
                .join(' · ') || undefined,
          }
        )
      },
      onError: fail,
    })
  )
  const remove = useMutation(
    trpc.references.delete.mutationOptions({
      onSuccess: () => {
        setRemoving(null)
        refresh()
      },
      onError: fail,
    })
  )

  const items = library ?? []
  const needle = query.trim().toLowerCase()
  const shown = useMemo(
    () => (needle ? items.filter((item) => referenceSearchText(item).includes(needle)) : items),
    [items, needle]
  )

  const exportBib = async () => {
    const { bibtex } = await client.references.bibtex.query({})
    downloadText('references.bib', bibtex, 'application/x-bibtex')
  }

  return (
    <Page wide>
      <PageHeader
        title='References'
        description='Your library for citations. Fix a reference once and every citation of it updates.'
        actions={
          <>
            <Button
              variant='outline'
              onClick={() => file.current?.click()}
              disabled={importFile.isPending}
            >
              {importFile.isPending ? <Loader2 className='animate-spin' /> : <FileUp />}
              Import
            </Button>
            <Button
              variant='outline'
              onClick={() => void exportBib()}
              disabled={items.length === 0}
            >
              <Download /> BibTeX
            </Button>
            <Button
              onClick={() =>
                setEditing({ id: null, key: '', csl: { id: '', type: 'article-journal' } })
              }
            >
              <Plus /> Add by hand
            </Button>
          </>
        }
      />
      <input
        ref={file}
        type='file'
        hidden
        accept='.bib,.bibtex,.ris,.json,.csljson,application/json,text/plain'
        onChange={async (event) => {
          const chosen = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!chosen) return
          importFile.mutate({ text: await chosen.text(), filename: chosen.name })
        }}
      />

      <form
        className='mb-6 flex gap-2 rounded-xl bg-card p-2 shadow-surface'
        onSubmit={(event) => {
          event.preventDefault()
          if (lookup.trim()) add.mutate({ input: lookup.trim() })
        }}
      >
        <Input
          value={lookup}
          onChange={(event) => setLookup(event.currentTarget.value)}
          placeholder='Paste a DOI, arXiv ID, ISBN or web address'
          aria-label='DOI, arXiv ID, ISBN or web address'
          className='border-0 bg-transparent shadow-none before:shadow-none'
        />
        <Button type='submit' disabled={!lookup.trim() || add.isPending}>
          {add.isPending ? <Loader2 className='animate-spin' /> : <Plus />}
          Add
        </Button>
      </form>

      {items.length > 0 ? (
        <div className='relative mb-4 max-w-sm'>
          <Search className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 text-muted-foreground' />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder='Search by author, title, year or key'
            aria-label='Search references'
            className='pl-8'
          />
        </div>
      ) : null}

      {isLoading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Library />}
          title='Your library is empty'
          description='Paste a DOI or arXiv ID above, or import a .bib, .ris or CSL-JSON file from Zotero, Mendeley or another manager.'
        />
      ) : (
        <ul className='flex flex-col divide-y divide-border/60'>
          {shown.map((item) => {
            const formatted = formatReference(item.csl, 'apa')
            return (
              <li key={item.id} className='group/ref flex items-start gap-4 py-3.5'>
                <div className='min-w-0 flex-1'>
                  <p
                    className='font-serif text-[15px] text-foreground leading-relaxed [&_i]:italic'
                    dangerouslySetInnerHTML={{ __html: formatted.html }}
                  />
                  <p className='mt-1 font-mono text-[12px] text-muted-foreground'>@{item.key}</p>
                </div>
                <Menu>
                  <MenuTrigger
                    render={
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label={`Actions for ${item.key}`}
                        className='opacity-0 transition-opacity focus-visible:opacity-100 group-hover/ref:opacity-100'
                      >
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                  <MenuPopup align='end'>
                    <MenuItem
                      onClick={() => setEditing({ id: item.id, key: item.key, csl: item.csl })}
                    >
                      <Pencil /> Edit
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      variant='destructive'
                      onClick={() => setRemoving({ id: item.id, label: item.key })}
                    >
                      <Trash2 /> Delete
                    </MenuItem>
                  </MenuPopup>
                </Menu>
              </li>
            )
          })}
          {needle && shown.length === 0 ? (
            <li className='py-10 text-center text-[14px] text-muted-foreground'>
              Nothing matches “{query}”.
            </li>
          ) : null}
        </ul>
      )}

      <ReferenceEditor
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          refresh()
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete @${removing?.label}?`}
        description='Citations of it will show as missing until you add it back.'
        confirmText='Delete'
        confirmVariant='destructive'
        isConfirmLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate({ ids: [removing.id] })}
      />
    </Page>
  )
}
