import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { localDay, longDate, newClientId } from '@/lib/format'
import { getUntitledTitle } from '@/lib/utils'
import { useTRPC } from '@/trpc/client'

/**
 * Creating things from anywhere in the workspace (sidebar, home, command
 * palette, shortcuts): a post, a note, a book, or opening today's note.
 * Each opens what it made.
 */
export function useCreate() {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const open = useCallback(
    (docId: string) => navigate({ to: '/write/$docId', params: { docId } }),
    [navigate]
  )
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: trpc.documents.getUserDocuments.pathKey() })
  }, [queryClient, trpc])
  const fail = (error: { message?: string }) => toast.error(error.message || 'Something went wrong')

  const document = useMutation(
    trpc.documents.createDocument.mutationOptions({
      onSuccess: (doc) => {
        refresh()
        void open(doc.id)
      },
      onError: fail,
    })
  )
  const book = useMutation(
    trpc.books.create.mutationOptions({
      onSuccess: ({ book: created }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.books.list.queryKey() })
        void navigate({ to: '/app/books/$bookId', params: { bookId: created.id } })
      },
      onError: fail,
    })
  )
  const daily = useMutation(
    trpc.notes.daily.mutationOptions({
      onSuccess: (doc) => {
        refresh()
        void open(doc.id)
      },
      onError: fail,
    })
  )

  return {
    createPost: () => document.mutate({ kind: 'post', title: getUntitledTitle('') }),
    createNote: () => document.mutate({ kind: 'note', id: newClientId() }),
    createBook: () => book.mutate({}),
    openToday: () => daily.mutate({ date: localDay(), title: longDate(), id: newClientId() }),
    isPending: document.isPending || book.isPending || daily.isPending,
  }
}
