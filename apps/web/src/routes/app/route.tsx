import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import { Sidebar, SidebarCreateDocumentButton } from '@/components/sidebar'
import { getSession } from '@/lib/auth.server'
import { useSession } from '@/lib/auth-client'
import { buildSeoHead } from '@/lib/seo'
import { type Document, documentStore, useDocumentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session.data?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.data?.user }
  },
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
  head: () =>
    buildSeoHead({
      canonicalPath: '/app',
      description:
        'Your Lemma workspace for drafting, editing, and organizing structured knowledge.',
      noIndex: true,
      title: 'Workspace',
      type: 'website',
    }),
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
  const isPageLoadedRef = useRef(false)

  const setupStore = useCallback(async () => {
    if (!isPageLoadedRef.current && !isPending && session?.user) {
      documentStore.persist.clearStorage()
      documentStore.persist.setOptions({
        name: `documents-storage-${session.user.id}`,
      })
      await documentStore.persist.rehydrate()
    }
  }, [isPending, session])

  useEffect(() => {
    setupStore()
  }, [setupStore])

  const initData = useCallback(async () => {
    if (!session && !isPending) return

    if (!documents && !documentsLoading) {
      isPageLoadedRef.current = true
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
      isPageLoadedRef.current = true
    }
  }, [documents, documentsLoading, isPending, session, setDocuments])

  useEffect(() => {
    if (!session?.user && !isPending) {
      navigate({ to: '/login', replace: true })
      return
    }

    if (!isPageLoadedRef.current && session?.user) {
      initData()
    }
  }, [initData, isPending, navigate, session])

  if (!session?.user && isPending) {
    return null
  }
  if (!session?.user) {
    return null
  }

  return (
    <main className='flex min-h-screen flex-1 bg-background'>
      <Sidebar />
      <div className='flex min-w-0 flex-1 flex-col'>
        <header className='sticky top-0 z-40 flex items-center justify-between border-border/70 border-b bg-background/95 px-3 py-2 backdrop-blur md:hidden'>
          <div className='flex min-w-0 items-center gap-2'>
            <Link to='/app' className='truncate text-base font-semibold tracking-tight'>
              Lemma
            </Link>
          </div>
          <div className='flex items-center gap-1'>
            <SidebarCreateDocumentButton className='size-9' />
            <Link
              aria-label='Settings'
              className='inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              to='/app/settings'
            >
              <Settings className='size-4' />
            </Link>
          </div>
        </header>
        <Outlet />
      </div>
    </main>
  )
}
