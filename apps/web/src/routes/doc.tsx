import AdvancedEditor from '@/components/editor'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/doc')({
  component: RouteComponent,
})

function RouteComponent() {
  const [title, setTitle] = useState('Untitled')
  const [subtitle, setSubtitle] = useState('')

  return (
    <div className='h-full w-full'>
      <AdvancedEditor
        title={title}
        subtitle={subtitle}
        onTitleChange={setTitle}
        onSubtitleChange={setSubtitle}
      />
    </div>
  )
}
