import { DocumentLibraryList } from '@/components/home/document-library-list'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_new/app/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className='max-w-3xl mx-auto w-full pt-8'>
      <div className='flex items-center justify-between border-b border-border pb-4'>
        <h1 className='text-xl font-medium'>Library</h1>
      </div>
      <DocumentLibraryList />
    </div>
  )
}
