import { createFileRoute } from '@tanstack/react-router'

import { ProfileHeader } from '@/components/landing'
import { NewsletterSubscribeForm } from '@/components/newsletter-subscribe-form'

export const Route = createFileRoute('/newsletter')({
  component: RouteComponent,
  head: () => {
    return { meta: [{ title: 'Newsletter' }] }
  },
})

function RouteComponent() {
  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <ProfileHeader
        title='Newsletter'
        current='Newsletter'
        links={[
          { label: 'About', to: '/' },
          { label: 'Blog', to: '/posts' },
          { label: 'Newsletter', to: '/newsletter' },
          { label: 'GitHub', href: 'https://github.com/irere123' },
        ]}
      />

      <section className='space-y-6'>
        <div className='space-y-4'>
          <h2 className='text-2xl font-bold text-gray-900'>Subscribe to the Newsletter</h2>
          <p className='text-[15px] leading-7 text-neutral-800'>
            Get occasional emails about new posts and notes on edge runtimes, DX, and practical
            engineering. No spam—unsubscribe anytime.
          </p>
        </div>

        <NewsletterSubscribeForm />
      </section>
    </main>
  )
}
