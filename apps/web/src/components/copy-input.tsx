import { IconCheck, IconCopy } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useCopyToClipboard } from 'usehooks-ts'

import { cn } from '@/lib/utils'

type Props = {
  value: string
  className?: string
}

export function CopyInput({ value, className }: Props) {
  const [isCopied, setCopied] = useState(false)
  const [, copy] = useCopyToClipboard()

  const handleClipboard = () => {
    setCopied(true)

    copy(value)

    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  // Show first 8 and last 8 characters with ellipsis
  const displayValue = value.length > 20 ? `${value.slice(0, 8)}...${value.slice(-8)}` : value

  return (
    <button
      type='button'
      onClick={handleClipboard}
      className={cn(
        'flex items-center relative w-full border border-input bg-background text-foreground py-2 px-4 cursor-pointer rounded-md hover:bg-accent transition-colors',
        className
      )}
    >
      <div className='pr-8 text-muted-foreground text-sm font-mono overflow-hidden text-left flex-1 min-w-0'>
        {displayValue}
      </div>

      <motion.div
        className='absolute right-4 top-2.5 text-muted-foreground'
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: isCopied ? 0 : 1, scale: isCopied ? 0 : 1 }}
      >
        <IconCopy className='w-4 h-4' />
      </motion.div>

      <motion.div
        className='absolute right-4 top-2.5 text-green-600'
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: isCopied ? 1 : 0, scale: isCopied ? 1 : 0 }}
      >
        <IconCheck className='w-4 h-4' />
      </motion.div>
    </button>
  )
}
