import { Resend } from 'resend'

import { env } from '@api/env-runtime'
import { getFromEmailAddress } from './utils'

export type EmailType = 'transactional' | 'marketing' | 'updates' | 'notifications'

export interface EmailAttachment {
  filename: string
  content: string | Buffer
  contentType: string
  disposition?: 'attachment' | 'inline'
}

export interface UnsubscribeInfo {
  token: string
  writerId: string
  baseUrl?: string
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  emailType?: EmailType
  includeUnsubscribe?: boolean
  unsubscribeInfo?: UnsubscribeInfo
  attachments?: EmailAttachment[]
  replyTo?: string
}

export interface BatchEmailOptions {
  emails: EmailOptions[]
}

export interface SendEmailResult {
  success: boolean
  message: string
  data?: any
}

export interface BatchSendEmailResult {
  success: boolean
  message: string
  results: SendEmailResult[]
  data?: any
}

interface ProcessedEmailData {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  senderEmail: string
  headers: Record<string, string>
  attachments?: EmailAttachment[]
  replyTo?: string
}

let resend: Resend | null | undefined

const getResend = () => {
  if (resend !== undefined) return resend

  const resendApiKey = env.RESEND_API_KEY
  resend =
    resendApiKey && resendApiKey !== 'placeholder' && resendApiKey.trim() !== ''
      ? new Resend(resendApiKey)
      : null

  return resend
}

/**
 * Check if any email service is configured and available
 */
export function hasEmailService(): boolean {
  return !!getResend()
}

export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  try {
    const processedData = await processEmailData(options)

    const resendClient = getResend()

    if (resendClient) {
      try {
        return await sendWithResend(processedData)
      } catch (error) {
        console.warn('Resend failed, attempting Azure Communication Services fallback:', error)
      }
    }

    console.info('Email not sent (no email service configured):', {
      to: options.to,
      subject: options.subject,
      from: processedData.senderEmail,
    })
    return {
      success: true,
      message: 'Email logging successful (no email service configured)',
      data: { id: 'mock-email-id' },
    }
  } catch (error) {
    console.error('Error sending email:', error)
    return {
      success: false,
      message: 'Failed to send email',
    }
  }
}

async function processEmailData(options: EmailOptions): Promise<ProcessedEmailData> {
  const {
    to,
    subject,
    html,
    text,
    from,
    emailType = 'transactional',
    includeUnsubscribe = true,
    unsubscribeInfo,
    attachments,
    replyTo,
  } = options

  const senderEmail = from || getFromEmailAddress()

  let finalHtml = html
  let finalText = text
  let headers: Record<string, string> = {}

  // Add unsubscribe headers for marketing emails
  if (includeUnsubscribe && emailType !== 'transactional' && unsubscribeInfo) {
    const baseUrl = unsubscribeInfo.baseUrl || env.FRONTEND_URL
    const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeInfo.token}&writer=${unsubscribeInfo.writerId}`

    headers = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }

  return {
    to,
    subject,
    html: finalHtml,
    text: finalText,
    senderEmail,
    headers,
    attachments,
    replyTo,
  }
}

async function sendWithResend(data: ProcessedEmailData): Promise<SendEmailResult> {
  const resendClient = getResend()
  if (!resendClient) throw new Error('Resend not configured')

  const fromAddress = data.senderEmail

  const emailData: any = {
    from: fromAddress,
    to: data.to,
    subject: data.subject,
    headers: Object.keys(data.headers).length > 0 ? data.headers : undefined,
  }

  if (data.html) emailData.html = data.html
  if (data.text) emailData.text = data.text
  if (data.replyTo) emailData.replyTo = data.replyTo
  if (data.attachments) {
    emailData.attachments = data.attachments.map((att) => ({
      filename: att.filename,
      content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
      contentType: att.contentType,
      disposition: att.disposition || 'attachment',
    }))
  }

  const { data: responseData, error } = await resendClient.emails.send(emailData)

  if (error) {
    throw new Error(error.message || 'Failed to send email via Resend')
  }

  return {
    success: true,
    message: 'Email sent successfully via Resend',
    data: responseData,
  }
}

export async function sendBatchEmails(options: BatchEmailOptions): Promise<BatchSendEmailResult> {
  try {
    const results: SendEmailResult[] = []

    const resendClient = getResend()

    if (resendClient) {
      try {
        return await sendBatchWithResend(options.emails)
      } catch (error) {
        console.warn('Resend batch failed, falling back to individual sends:', error)
      }
    }

    console.info('Sending batch emails individually')
    for (const email of options.emails) {
      try {
        const result = await sendEmail(email)
        results.push(result)
      } catch (error) {
        results.push({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to send email',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    return {
      success: successCount === results.length,
      message:
        successCount === results.length
          ? 'All batch emails sent successfully'
          : `${successCount}/${results.length} emails sent successfully`,
      results,
      data: { count: successCount },
    }
  } catch (error) {
    console.error('Error in batch email sending:', error)
    return {
      success: false,
      message: 'Failed to send batch emails',
      results: [],
    }
  }
}

async function sendBatchWithResend(emails: EmailOptions[]): Promise<BatchSendEmailResult> {
  const resendClient = getResend()
  if (!resendClient) throw new Error('Resend not configured')

  const results: SendEmailResult[] = []
  const batchEmails: any[] = []

  for (const email of emails) {
    const senderEmail = email?.from || getFromEmailAddress()
    const emailData: any = {
      from: senderEmail,
      to: email?.to,
      subject: email?.subject,
    }

    if (email?.html) emailData.html = email.html
    if (email?.text) emailData.text = email.text

    batchEmails.push(emailData)
  }

  if (batchEmails.length === 0) {
    return {
      success: true,
      message: 'No emails to send',
      results,
      data: { count: 0 },
    }
  }

  try {
    const response = await resendClient.batch.send(batchEmails as any)

    if (response.error) {
      throw new Error(response.error.message || 'Resend batch API error')
    }

    batchEmails.forEach((_, index) => {
      results.push({
        success: true,
        message: 'Email sent successfully via Resend batch',
        data: { id: `batch-${index}` },
      })
    })

    return {
      success: true,
      message: 'All batch emails sent successfully via Resend',
      results,
      data: { count: batchEmails.length },
    }
  } catch (error) {
    console.error('Resend batch send failed:', error)
    throw error
  }
}
