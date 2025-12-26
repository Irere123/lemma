import type { Document } from '@/stores/document-store'
import { Button } from './ui/button'
import { IconGlobe, IconGlobeOff, IconSettings, IconMail } from '@tabler/icons-react'
import { DocumentMoreDropdown } from './dropdowns'

type Props = {
  document: Document
  isSynced: boolean
  isUpsertLoading: boolean
  onPublish: () => void
  onUnpublish: () => void
  onOpenSettings: () => void
  onOpenNewsletter?: () => void
}

export function EditorHeader({
  document,
  isSynced,
  onPublish,
  onUnpublish,
  isUpsertLoading,
  onOpenSettings,
  onOpenNewsletter,
}: Props) {
  return (
    <div className='w-full flex justify-between px-8 pt-4 pb-2 md:px-12'>
      {/* Top toolbar */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                document.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {document.status || 'DRAFT'}
            </span>
          </div>

          {/* Sync Status Indicator */}
          <div className='flex items-center gap-2'>
            <div
              className={`h-2 w-2 rounded-full ${
                isSynced ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
              }`}
            />
            <span className='text-xs text-gray-500'>
              {isSynced ? 'All changes saved' : 'Saving...'}
            </span>
          </div>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        {document.status === 'DRAFT' ? (
          <Button onClick={onPublish} variant='secondary' disabled={isUpsertLoading}>
            <IconGlobe />
            Publish
          </Button>
        ) : (
          <Button onClick={onUnpublish} variant='destructive' disabled={isUpsertLoading}>
            <IconGlobeOff />
            Unpublish
          </Button>
        )}
        {onOpenNewsletter && (
          <Button
            onClick={onOpenNewsletter}
            variant='ghost'
            size='icon'
            aria-label='Send newsletter'
          >
            <IconMail className='w-4 h-4' />
          </Button>
        )}
        <Button variant='ghost' size='icon' onClick={onOpenSettings} aria-label='Open settings'>
          <IconSettings />
        </Button>
        <DocumentMoreDropdown documentId={document.id} />
      </div>
    </div>
  )
}
