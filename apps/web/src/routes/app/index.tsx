import { createFileRoute } from '@tanstack/react-router'

import { DocumentLibraryList } from '@/components/home/document-library-list'

export const Route = createFileRoute('/app/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section className='mx-auto w-full max-w-4xl px-5 py-8 md:px-10'>
      <div className='mb-6 border-b border-border/70 pb-4'>
        <p className='text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground'>
          Workspace
        </p>
        <h1 className='mt-2 text-2xl font-semibold tracking-tight'>Library</h1>
      </div>
      <DocumentLibraryList />
    </section>
  )
}
