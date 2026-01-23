import { Sidebar } from '@/components/sidebar'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_new')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='flex flex-1'>
      <Sidebar />
      <div className='flex flex-col w-full'>
        <Outlet />
      </div>
    </main>
  )
}
