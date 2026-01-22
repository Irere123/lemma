import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_new')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
