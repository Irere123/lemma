import AdvancedEditor from '@/components/editor'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/doc')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className='h-full w-full '>
      <AdvancedEditor />
    </div>
  )
}
