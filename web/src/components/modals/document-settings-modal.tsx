import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'

import type { Document } from '@/stores/document-store'
import { getLocalDateTimeInputValue, parseLocalDateTimeInput } from '@/lib/date'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: Document
  onSave: (data: Partial<Document>) => Promise<void> | void
  isSaving?: boolean
}

export const DocumentSettingsModal: React.FC<Props> = ({
  open,
  onOpenChange,
  document,
  onSave,
  isSaving = false,
}) => {
  const [localTitle, setLocalTitle] = React.useState(document.title || '')
  const [localSubtitle, setLocalSubtitle] = React.useState(document.subtitle || '')
  const [bannerImage, setBannerImage] = React.useState(document.bannerImage || '')
  const [manualPublishedDate, setManualPublishedDate] = React.useState<boolean>(
    Boolean(document.publishedDate)
  )
  const [publishedDate, setPublishedDate] = React.useState<string>(() => {
    return document.publishedDate
      ? getLocalDateTimeInputValue(new Date(document.publishedDate))
      : ''
  })

  React.useEffect(() => {
    if (!open) return
    setLocalTitle(document.title || '')
    setLocalSubtitle(document.subtitle || '')
    setBannerImage(document.bannerImage || '')
    setManualPublishedDate(Boolean(document.publishedDate))
    setPublishedDate(
      document.publishedDate ? getLocalDateTimeInputValue(new Date(document.publishedDate)) : ''
    )
  }, [open, document])

  const parsedPublishedDate = React.useMemo(
    () => parseLocalDateTimeInput(publishedDate),
    [publishedDate]
  )

  const handleSave = async () => {
    const update: Partial<Document> = {
      id: document.id,
      title: localTitle || null,
      subtitle: localSubtitle || null,
      bannerImage: bannerImage || null,
      publishedDate: manualPublishedDate && parsedPublishedDate ? parsedPublishedDate : null,
    } as Partial<Document>
    await onSave(update)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label='Settings'>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure publishing settings.</DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-6'>
          <div className='flex items-center gap-3'>
            <input
              id='manual-published-date'
              type='checkbox'
              checked={manualPublishedDate}
              onChange={(e) => setManualPublishedDate(e.target.checked)}
              className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring'
              aria-label='Configure published date manually'
            />
            <label htmlFor='manual-published-date' className='text-sm text-gray-700'>
              Configure published date manually
            </label>
          </div>

          {manualPublishedDate ? (
            <div className='flex flex-col gap-2'>
              <label className='text-sm font-medium text-gray-700'>Published date</label>
              <input
                type='datetime-local'
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                className='px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring'
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant='secondary' onClick={() => onOpenChange(false)} aria-label='Cancel'>
            Cancel
          </Button>
          <Button onClick={handleSave} aria-label='Save settings' disabled={isSaving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
