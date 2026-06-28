import { Badge } from '@/components/ui/badge'

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | null

const VARIANT = {
  DRAFT: 'secondary',
  SCHEDULED: 'info',
  SENDING: 'warning',
  SENT: 'success',
  FAILED: 'error',
  CANCELLED: 'outline',
} as const

const LABEL = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  SENDING: 'Sending',
  SENT: 'Sent',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
} as const

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const key = status ?? 'DRAFT'
  return (
    <Badge variant={VARIANT[key]} size='sm'>
      {LABEL[key]}
    </Badge>
  )
}
