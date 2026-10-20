import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { type ChangeEvent, useRef } from 'react'

import { cn } from '@/lib/utils'
import { Button } from '../ui/button'

/**
 * The cover image. Without one, "Add cover" waits above the title and shows
 * on hover (always on touch screens), so an untouched page is just the text.
 */
export function Cover({
  image,
  uploading = false,
  disabled = false,
  onSelect,
  onRemove,
}: {
  image?: string | null
  uploading?: boolean
  disabled?: boolean
  onSelect?: (file: File) => void
  onRemove?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pick = () => inputRef.current?.click()
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) onSelect?.(file)
    event.currentTarget.value = ''
  }

  const input = (
    <input ref={inputRef} type='file' accept='image/*' className='hidden' onChange={onChange} />
  )

  if (image) {
    return (
      <figure className='group/cover relative mb-8 overflow-hidden rounded-xl bg-muted'>
        {input}
        <img src={image} alt='' className='aspect-[2.4/1] w-full object-cover' />
        <div className='absolute end-3 top-3 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/cover:opacity-100 pointer-coarse:opacity-100'>
          <Button
            type='button'
            size='xs'
            variant='outline'
            onClick={pick}
            disabled={disabled || uploading}
          >
            {uploading ? <Loader2 className='animate-spin' /> : <Upload />}
            Change cover
          </Button>
          <Button
            type='button'
            size='xs'
            variant='outline'
            onClick={onRemove}
            disabled={disabled || uploading}
            aria-label='Remove cover'
          >
            <Trash2 />
          </Button>
        </div>
      </figure>
    )
  }

  return (
    <div className='mb-3 flex h-8 items-center'>
      {input}
      <Button
        type='button'
        size='xs'
        variant='ghost'
        onClick={pick}
        disabled={disabled || uploading}
        className={cn(
          'text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/doc:opacity-100 pointer-coarse:opacity-100',
          uploading && 'opacity-100'
        )}
      >
        {uploading ? <Loader2 className='animate-spin' /> : <ImagePlus />}
        {uploading ? 'Uploading cover…' : 'Add cover'}
      </Button>
    </div>
  )
}
