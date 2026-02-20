import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/settings/')({
  component: RouteComponent,
  beforeLoad() {
    throw redirect({ to: '/app/settings/account', replace: true })
  },
})

function RouteComponent() {
  return null
}
