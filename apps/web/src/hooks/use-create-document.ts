import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { getUntitledTitle } from '@/lib/utils'
import { useDocumentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'

// Shared "create a blank document and open it" flow, used by both the sidebar
// button and the command palette so the behavior stays in one place.
export function useCreateDocument() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const upsertDocumentInStore = useDocumentStore((state) => state.upsertDocument)

  const mutation = useMutation(
    trpc.documents.upsertDocument.mutationOptions({
      onSuccess: async (document) => {
        if (!document?.id) {
          toast.error('Failed to create document')
          return
        }

        upsertDocumentInStore(document as any)

        await navigate({
          to: '/write/$docId',
          params: { docId: document.id },
        })
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create document')
      },
    })
  )

  const createDocument = () => {
    if (mutation.isPending) return
    mutation.mutate({ title: getUntitledTitle(''), markdown: '' })
  }

  return { createDocument, isPending: mutation.isPending }
}
