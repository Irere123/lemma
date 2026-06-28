import { Badge } from '@/components/ui/badge'

export type SubscriberStatus = 'confirmed' | 'pending' | 'unsubscribed'

export function subscriberStatus(sub: {
  isConfirmed?: boolean | null
  isUnsubscribed?: boolean | null
}): SubscriberStatus {
  if (sub.isUnsubscribed) return 'unsubscribed'
  if (sub.isConfirmed) return 'confirmed'
  return 'pending'
}

const VARIANT = {
  confirmed: 'success',
  pending: 'warning',
  unsubscribed: 'error',
} as const

const LABEL = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  unsubscribed: 'Unsubscribed',
} as const

export function SubscriberStatusBadge({ status }: { status: SubscriberStatus }) {
  return (
    <Badge variant={VARIANT[status]} size='sm'>
      {LABEL[status]}
    </Badge>
  )
}
