import { IconAlignLeft } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { isToday } from 'date-fns'

type Document = {
  id: number
  title: string
  createdAt: Date
}

const documents: Document[] = [
  {
    id: 1,
    title: 'How to build a website',
    createdAt: new Date(),
  },
  {
    id: 2,
    title: 'How to build a mobile app',
    createdAt: new Date(),
  },
  {
    id: 3,
    title: 'How to build a desktop app',
    createdAt: new Date(Date.now() - 86400000), // Yesterday
  },
  {
    id: 4,
    title: 'Thsi is a very long title that should be truncated',
    createdAt: new Date(Date.now() - 172800000), // 2 days ago
  },
]

export function DocumentsHistoryList() {
  const groupedDocuments = documents.reduce(
    (acc, doc) => {
      const group = isToday(doc.createdAt) ? 'Today' : ('Past' as 'Today' | 'Past')
      if (!acc[group]) {
        acc[group] = [] as Document[]
      }
      acc[group].push(doc)
      return acc as Record<'Today' | 'Past', Document[]>
    },
    {} as Record<'Today' | 'Past', Document[]>
  )

  return (
    <div className='space-y-4'>
      {Object.entries(groupedDocuments).map(([group, docs]) => (
        <div key={group}>
          <h2 className='text-xs font-semibold py-2'>{group}</h2>
          <div className='space-y-2'>
            {docs.map((document) => (
              <Link
                key={document.id}
                to={`/write/$docId`}
                params={{ docId: document.id.toString() }}
                className='flex items-center gap-2 rounded-sm border border-neutral-100 p-1.5'
              >
                <IconAlignLeft size={14} />
                <p className='text-sm text-ellipsis overflow-hidden whitespace-nowrap'>
                  {document.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
