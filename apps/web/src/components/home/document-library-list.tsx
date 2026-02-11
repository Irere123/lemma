import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'

import { Skeleton } from '@/components/ui/skeleton'
import { useTRPC } from '@/trpc/client'

export function DocumentLibraryList() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.documents.getUserDocuments.queryOptions({}))

  if (isLoading) {
    return (
      <div className='flex flex-col gap-2 py-6'>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className='flex items-center justify-between py-2'>
            <div className='flex-1'>
              <Skeleton className='h-5 w-48 mb-1' />
            </div>
            <div className='flex items-center gap-3'>
              <Skeleton className='h-4 w-12' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const documents = data?.documents || []

  if (documents.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-center'>
        <p className='text-sm text-muted-foreground'>No documents yet</p>
        <p className='text-xs text-muted-foreground mt-1'>
          Create your first document to get started
        </p>
      </div>
    )
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
    },
  }

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 8,
      filter: 'blur(4px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
    },
    exit: {
      opacity: 0,
      y: -8,
      filter: 'blur(4px)',
    },
  }

  return (
    <LayoutGroup>
      <motion.div
        className='flex flex-col py-6'
        variants={containerVariants}
        initial='hidden'
        animate='visible'
        layout
        style={{ position: 'relative' }}
        transition={{
          staggerChildren: 0.03,
          delayChildren: 0.05,
          ease: [0.19, 1, 0.22, 1] as const,
        }}
      >
        <AnimatePresence mode='popLayout'>
          {documents.map((document) => {
            const formattedDate = document.createdAt
              ? format(new Date(document.createdAt), 'dd/MM')
              : '00/00'

            const year = document.createdAt ? format(new Date(document.createdAt), 'yyyy') : '2026'

            return (
              <motion.div
                key={document.id}
                layout
                variants={itemVariants}
                initial='hidden'
                animate='visible'
                exit={{
                  ...itemVariants.exit,
                  transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const },
                }}
                transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] as const }}
                className='flex items-center justify-between py-3 border-b border-border/30 last:border-b-0'
              >
                <div className='flex items-center gap-4 flex-1 min-w-0'>
                  <motion.span layout className='text-sm text-muted-foreground shrink-0'>
                    {year}
                  </motion.span>
                  <Link
                    to='/write/$docId'
                    params={{ docId: document.id }}
                    className='text-base font-medium text-foreground hover:underline truncate'
                  >
                    {document.title || 'Untitled'}
                  </Link>
                </div>
                <motion.span
                  layout
                  className='text-sm text-muted-foreground whitespace-nowrap ml-4 shrink-0'
                >
                  {formattedDate}
                </motion.span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  )
}
