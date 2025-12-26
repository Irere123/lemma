import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { Button } from './button'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  isConfirmLoading?: boolean
  confirmVariant?: 'default' | 'destructive' | 'secondary' | 'ghost' | 'outline'
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title = 'Are you absolutely sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isConfirmLoading = false,
  confirmVariant = 'destructive',
}) => {
  const handleCancel = () => {
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label={title}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button type='button' variant='secondary' onClick={handleCancel} aria-label={cancelText}>
            {cancelText}
          </Button>
          <Button
            type='button'
            variant={confirmVariant}
            onClick={handleConfirm}
            aria-label={confirmText}
            disabled={isConfirmLoading}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
