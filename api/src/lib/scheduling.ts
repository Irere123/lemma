type NewsletterScheduleMode = 'immediate' | 'scheduled' | 'past'

export type NewsletterScheduleResult = {
  delayMs: number
  mode: NewsletterScheduleMode
  scheduledFor: string | null
}

type ComputeNewsletterScheduleInput = {
  sendImmediately: boolean
  scheduledDate?: Date | null
}

const getDelayMs = (scheduledUtc: Date, nowUtc: Date) => {
  return Math.max(0, scheduledUtc.getTime() - nowUtc.getTime())
}

export const computeNewsletterSchedule = ({
  sendImmediately,
  scheduledDate,
}: ComputeNewsletterScheduleInput): NewsletterScheduleResult => {
  if (sendImmediately || !scheduledDate) {
    return {
      delayMs: 0,
      mode: 'immediate',
      scheduledFor: null,
    }
  }

  const scheduledUtc = new Date(scheduledDate)

  if (Number.isNaN(scheduledUtc.getTime())) {
    return {
      delayMs: 0,
      mode: 'immediate',
      scheduledFor: null,
    }
  }

  const nowUtc = new Date()

  if (scheduledUtc <= nowUtc) {
    return {
      delayMs: 0,
      mode: 'past',
      scheduledFor: scheduledUtc.toISOString(),
    }
  }

  const delayMs = getDelayMs(scheduledUtc, nowUtc)

  return {
    delayMs,
    mode: 'scheduled',
    scheduledFor: scheduledUtc.toISOString(),
  }
}
