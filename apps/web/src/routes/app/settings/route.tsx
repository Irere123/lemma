import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { motion } from 'motion/react'

export const Route = createFileRoute('/app/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const links = [
    { label: 'Account', to: '/app/settings/account' },
    { label: 'API Keys', to: '/app/settings/api-keys' },
    { label: 'Apps', to: '/app/settings/apps' },
  ] as const

  const isActive = (to: (typeof links)[number]['to']) =>
    pathname === to || pathname.startsWith(`${to}/`)

  return (
    <main className='mx-auto w-full max-w-4xl px-5 py-8 md:px-10'>
      <h2 className='font-semibold text-2xl tracking-tight'>Settings</h2>

      <motion.nav
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className='mt-6 flex w-fit flex-wrap gap-2 rounded-xl border border-border/80 bg-muted/30 p-1'
      >
        {links.map((link) => {
          const active = isActive(link.to)

          return (
            <Link
              key={link.to}
              to={link.to}
              className='relative inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-sm'
            >
              {active && (
                <motion.span
                  layoutId='settings-nav-active-pill'
                  className='absolute inset-0 rounded-lg bg-background shadow-sm'
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
              <motion.span
                className='relative z-10'
                animate={{ scale: active ? 1 : 0.985 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
              >
                {link.label}
              </motion.span>
            </Link>
          )
        })}
      </motion.nav>

      <div className='mt-6'>
        <Outlet />
      </div>
    </main>
  )
}
