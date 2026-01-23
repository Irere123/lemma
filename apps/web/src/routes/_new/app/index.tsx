import { WritingList } from '@/components/home/writing-list'
import { IconAlignLeft, IconMenu2 } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_new/app/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className='max-w-3xl mx-auto w-full pt-8'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-medium'>Writings</h1>
        <div className='flex items-center gap-2'>
          <IconMenu2 />
          <IconAlignLeft />
        </div>
      </div>
      <WritingList />
    </div>
  )
}
