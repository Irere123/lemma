import { format } from 'date-fns'

interface ArticleProps {
  title: string
  description: string
  image: string
  url: string
  status: string
  publishedAt: string
  isGrid: boolean
}

export function Article({
  title,
  description,
  image,
  url,
  status,
  publishedAt,
  isGrid,
}: ArticleProps) {
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex gap-2'>
        <img src={image} alt={title} className='w-10 h-10 rounded-sm' />
        <div>
          <h2 className='text-lg font-medium'>{title}</h2>
          <p className='text-sm text-muted-foreground'>{format(publishedAt, 'MMM d, yyyy')}</p>
        </div>
      </div>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>{description}</p>
        <p className='text-sm text-muted-foreground'>{status}</p>
      </div>
    </div>
  )
}
