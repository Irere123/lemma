import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_new/app/documents/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_new/app/documents/"!</div>
}
