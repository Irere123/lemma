import { createFileRoute, Link } from '@tanstack/react-router'

import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Lemma | Writing' },
      {
        name: 'description',
        content: 'A calm writing app for drafting, editing, and publishing.',
      },
    ],
  }),
  component: Home,
})

function Home() {
  return (
    <main className='relative min-h-screen overflow-hidden bg-[#f7f8fa] text-neutral-700'>
      <div aria-hidden className='hero-ambient pointer-events-none absolute inset-0'>
        <div className='hero-orb hero-orb-left' />
        <div className='hero-orb hero-orb-right' />
      </div>

      <div className='relative z-10 mx-auto flex w-full max-w-2xl flex-col px-4 pb-40 pt-8 sm:px-6 sm:pt-10'>
        <header className='flex items-center justify-between'>
          <p className='text-lg font-bold'>Lemma</p>
          <Button variant='link' size='sm'>
            <Link to='/login' className='text-sm underline underline-offset-4'>
              Login
            </Link>
          </Button>
        </header>

        <section className='hero-stage mt-14 leading-8 sm:mt-16'>
          <div className='hero-stack group/hero relative'>
            <a
              href='https://github.com/Irere123/lemma'
              target='_blank'
              rel='noopener'
              aria-label='View Lemma on GitHub'
              className='hero-sticker hero-sticker-right'
            >
              <img
                src='/ramen_noun.svg'
                alt='Ramen sticker'
                loading='lazy'
                width={112}
                height={100}
                decoding='async'
                className='h-20 w-20 drop-shadow-sm md:h-24 md:w-24'
              />
            </a>
            <a
              href='https://github.com/Irere123/lemma'
              target='_blank'
              rel='noopener'
              aria-label='View Lemma on GitHub'
              className='hero-sticker hero-sticker-left hidden sm:block'
            >
              <img
                src='/sunny.svg'
                alt='Sun sticker'
                loading='lazy'
                width={56}
                height={56}
                decoding='async'
                className='h-14 w-14 drop-shadow-sm md:h-16 md:w-16'
              />
            </a>

            <article className='hero-note w-full rounded-xl border-8 border-stone-50 bg-[#EEE7D7] p-4 font-hand-writing sm:p-5 md:p-6'>
              <div className='space-y-2'>
                <h1 className='text-2xl font-medium tracking-tight'>
                  make thoughts actionable and reusable
                </h1>
                <p>
                  A simple home for drafting, refining, and publishing your writing. Built for focus
                  and speed.
                </p>
              </div>

              <div className='mt-5 space-y-2'>
                <h2 className='font-bold'>About</h2>
                <p>
                  Built for personal usage, designed with personal preferences. Clean interface.
                  API-first design. Drafts stay organized, edits stay calm, and publishing stays
                  clear.
                </p>

                <p>Designed for writers who want less noise and more momentum.</p>
              </div>
            </article>
          </div>
        </section>
      </div>

      <div className='hero-tree pointer-events-none absolute -bottom-3 -left-4 w-56 sm:w-64 md:-bottom-5 md:-left-2 md:w-80 hidden sm:block'>
        <img src='/images/treeWithLeaves/tree1.png' alt='' />
        <img
          src='/images/treeWithLeaves/leaves1.png'
          alt=''
          className='hero-tree-leaf-1 animate-sweep absolute'
        />
        <img
          src='/images/treeWithLeaves/leaves2.png'
          alt=''
          className='hero-tree-leaf-2 animate-sweepLarge absolute'
        />
        <img
          src='/images/treeWithLeaves/leaves3.png'
          alt=''
          className='hero-tree-leaf-3 animate-sweepFast absolute'
        />
      </div>

      <Footer />
    </main>
  )
}
