import { createFileRoute, Outlet } from '@tanstack/react-router'

import { SidebarProvider } from '@/components/ui/sidebar'

export const Route = createFileRoute('/_developers')({
  component: RouteComponent,
  head: async () => {
    return {
      meta: [
        {
          title: 'Developers Portal',
        },
      ],
    }
  },
})

function RouteComponent() {
  return (
    <SidebarProvider>
      <div className='w-full'>
        <Outlet />
      </div>
    </SidebarProvider>
  )
}
