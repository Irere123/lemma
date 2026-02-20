import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import AdvancedEditor from '@/components/editor'
import { buildSeoHead } from '@/lib/seo'

export const Route = createFileRoute('/doc')({
  head: () =>
    buildSeoHead({
      canonicalPath: '/doc',
      description: 'Draft and preview documents in Lemma.',
      noIndex: true,
      title: 'Document',
      type: 'article',
    }),
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
