import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'

import { getPostBySlug } from '@/lib/api/posts'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/posts/$slug')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { slug } = params

    const post = await getPostBySlug(slug)

    return { post }
  },
  head: async ({ loaderData }) => {
    return {
      meta: [
        {
          title: loaderData?.post?.title,
        },
        {
          description: loaderData?.post?.subtitle,
          content: loaderData?.post?.subtitle,
        },
        {
          name: 'og:title',
          content: loaderData?.post?.title,
        },
        {
          name: 'og:description',
          content: loaderData?.post?.subtitle,
        },
      ],
    }
  },
})

function RouteComponent() {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const { post } = Route.useLoaderData()

  if (!post?.id) {
    navigate({ to: '/posts' })
    return null
  }

  return (
    <main className='container mx-auto max-w-3xl px-6 py-10'>
      <nav className='flex items-center justify-between mb-6'>
        <Link
          to='/posts'
          className='group flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gray-100 transition-colors duration-300 ease-out hover:bg-gray-200 active:scale-[0.97] will-change-transform'
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='none'
            className='stroke-gray-600 group-hover:stroke-gray-120 mr-[2px] h-[18px] w-[18px] transition-colors duration-300 ease-out'
          >
            <path
              d='M9 14L4 9M4 9L9 4M4 9H10.4C13.7603 9 15.4405 9 16.7239 9.65396C17.8529 10.2292 18.7708 11.1471 19.346 12.2761C20 13.5595 20 15.2397 20 18.6V20'
              strokeWidth='2.25'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </Link>
        <button
          aria-label='Copy URL'
          onClick={() => {}}
          className='group flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gray-100 transition-colors'
        >
          <div aria-hidden='true' style={{ opacity: 1, transform: 'none' }}>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              className='stroke-gray-600 group-hover:stroke-gray-120 h-4 w-4 transition-all duration-300 ease-out'
            >
              <path
                d='M9.99999 13C10.4294 13.5741 10.9773 14.0491 11.6065 14.3929C12.2357 14.7367 12.9315 14.9411 13.6466 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9547 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.552 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997M14 11C13.5705 10.4258 13.0226 9.95078 12.3934 9.60703C11.7642 9.26327 11.0685 9.05885 10.3533 9.00763C9.63819 8.95641 8.9204 9.0596 8.24864 9.31018C7.57688 9.56077 6.96687 9.9529 6.45999 10.46L3.45999 13.46C2.5492 14.403 2.04522 15.666 2.05662 16.977C2.06801 18.288 2.59385 19.542 3.52089 20.4691C4.44793 21.3961 5.702 21.9219 7.01298 21.9333C8.32396 21.9447 9.58697 21.4408 10.53 20.53L12.24 18.82'
                strokeWidth='2.25'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </div>
        </button>
      </nav>

      <article>
        <header className='mb-6'>
          <h1 className='text-2xl font-semibold tracking-tight'>{post.title || 'Untitled'}</h1>
          {post.subtitle && <p className='text-lg text-neutral-600 mt-2'>{post.subtitle}</p>}
          {post.publishedDate ? (
            <time
              dateTime={post.publishedDate.toString()}
              className='text-xs text-neutral-500 mt-2 block'
            >
              {format(new Date(post.publishedDate), 'MMMM d, yyyy')}
            </time>
          ) : null}
        </header>

        <section className='prose prose-neutral max-w-none'>
          {/* <BrainReadOnlyEditor content={post.content || []} className='text-base leading-7' /> */}
        </section>
      </article>
    </main>
  )
}
