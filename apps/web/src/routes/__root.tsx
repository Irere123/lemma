// src/routes/__root.tsx
/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'
import type { ReactNode } from 'react'

import appCss from '@/app.css?url'
import NotFound from '@/components/not-found'
import { buildRootSeoHead } from '@/lib/seo'
import { Providers } from '@/providers'

export const Route = createRootRoute({
  head: () => {
    const seo = buildRootSeoHead()
    return {
      meta: seo.meta,
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossOrigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Betania+Patmos+In+GDL&display=swap',
        },
      ],
    }
  },
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootErrorComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <NuqsAdapter>
        <Outlet />
      </NuqsAdapter>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en'>
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  )
}

function RootErrorComponent({ error }: { error: Error }) {
  return (
    <RootDocument>
      <div className='mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center'>
        <h1 className='text-xl font-semibold tracking-tight'>Something went wrong</h1>
        <p className='mt-3 text-sm text-muted-foreground'>{error?.message ?? 'Unexpected error'}</p>
      </div>
    </RootDocument>
  )
}
