import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { Sidebar } from '@/components/sidebar'
import { useSession } from '@/lib/auth-client'
import { getSession } from '@/lib/auth.server'
import { buildSeoHead } from '@/lib/seo'
import { type Document, documentStore, useDocumentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app')({
  head: () =>
    buildSeoHead({
      canonicalPath: '/app',
      description:
        'Your Lemma workspace for drafting, editing, and organizing structured knowledge.',
      noIndex: true,
      title: 'Workspace',
      type: 'website',
    }),
  loader: async ({ context }) => {
    if (typeof window === 'undefined') {
      const { serverPrefetch } = await import('@/trpc/server')
      const request = (context as any)?.request as Request | undefined

      await serverPrefetch({
        request,
        queryKey: [['documents', 'getUserDocuments'], { input: {}, type: 'query' }],
        fetchFn: (client) => client.documents.getUserDocuments.query({}),
      })
    }
  },
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { user: session.data?.user }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const { data: documents, isLoading: documentsLoading } = useQuery(
    trpc.documents.getUserDocuments.queryOptions({})
  )
  const setDocuments = useDocumentStore((state) => state.setDocuments)
  const [isPageLoaded, setIsPageLoaded] = useState(false)

  const setupStore = useCallback(async () => {
    if (!isPageLoaded && !isPending && session?.user) {
      documentStore.persist.clearStorage()
      documentStore.persist.setOptions({
        name: `documents-storage-${session.user.id}`,
      })
      await documentStore.persist.rehydrate()
    }
  }, [isPageLoaded, isPending, session])

  useEffect(() => {
    setupStore()
  }, [setupStore])

  const initData = useCallback(async () => {
    if (!session && !isPending) return

    if (!documents && !documentsLoading) {
      setIsPageLoaded(true)
      return
    }

    if (!documentsLoading) {
      const docsAsObj = documents?.documents.reduce<
        Record<Document['id'], Omit<Document, 'markdown'>>
      >((acc, doc) => {
        acc[doc.id] = doc
        return acc
      }, {})
      setDocuments(docsAsObj ?? {})
      setIsPageLoaded(true)
    }
  }, [documents, documentsLoading, isPending, session, setDocuments])

  useEffect(() => {
    if (!session?.user && !isPending) {
      navigate({ to: '/login', replace: true })
      return
    }

    if (!isPageLoaded && session?.user) {
      initData()
    }
  }, [initData, isPageLoaded, isPending, navigate, session])

  if (!session?.user && isPending) {
    return null
  }
  if (!session?.user) {
    return null
  }

  return (
    <main className='flex min-h-screen flex-1 flex-col bg-background md:flex-row'>
      <Sidebar />
      <div className='flex w-full flex-col'>
        <header className='flex items-center justify-between border-b border-border/70 px-4 py-3 md:hidden'>
          <Link to='/app' className='text-base font-semibold tracking-tight'>
            Lemma
          </Link>
        </header>
        <Outlet />
      </div>
    </main>
  )
}
