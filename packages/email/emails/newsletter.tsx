import { Body, Container, Head, Html, Link, Markdown, Preview, Text } from '@react-email/components'
import type { DocumentData, NewsletterSettings } from '../types'

interface Props {
  document: DocumentData
  writerSettings: NewsletterSettings
  recipientEmail: string
  unsubscribeToken?: string
}

export const DynamicDocumentNewsletter = ({
  document,
  writerSettings,
  recipientEmail,
  unsubscribeToken,
}: Props) => {
  const previewText = document.title || `New post from ${writerSettings.fromName}`

  const unsubscribeUrl = unsubscribeToken
    ? `${writerSettings.baseUrl}/unsubscribe?token=${unsubscribeToken}&writer=${writerSettings.id}`
    : undefined

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Title */}
          <Text style={styles.title}>{document.title || 'Untitled'}</Text>

          {/* Author byline */}
          <Text style={styles.byline}>
            {writerSettings.fromName} &middot; {writerSettings.newsletterName}
          </Text>

          {/* Main content */}
          {document.markdown && (
            <div style={styles.content}>
              <Markdown
                markdownCustomStyles={{
                  h1: { fontSize: '24px', fontWeight: '600', marginTop: '32px', marginBottom: '16px', lineHeight: '1.3' },
                  h2: { fontSize: '20px', fontWeight: '600', marginTop: '28px', marginBottom: '12px', lineHeight: '1.3' },
                  h3: { fontSize: '18px', fontWeight: '600', marginTop: '24px', marginBottom: '8px', lineHeight: '1.3' },
                  p: { marginTop: '0', marginBottom: '20px', lineHeight: '1.7' },
                  link: { color: '#0969da', textDecoration: 'underline' },
                  blockQuote: {
                    borderLeft: '3px solid #d0d7de',
                    paddingLeft: '16px',
                    marginLeft: '0',
                    marginRight: '0',
                    marginBottom: '20px',
                    color: '#57606a',
                    fontStyle: 'italic',
                  },
                  codeInline: {
                    backgroundColor: '#f6f8fa',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'ui-monospace, monospace',
                  },
                  codeBlock: {
                    backgroundColor: '#f6f8fa',
                    padding: '16px',
                    borderRadius: '6px',
                    overflow: 'auto',
                    marginBottom: '20px',
                  },
                  hr: { border: 'none', borderTop: '1px solid #d0d7de', margin: '32px 0' },
                  image: { maxWidth: '100%', height: 'auto', borderRadius: '4px' },
                }}
                markdownContainerStyles={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  fontSize: '17px',
                  lineHeight: '1.7',
                  color: '#1a1a1a',
                }}
              >
                {document.markdown}
              </Markdown>
            </div>
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            You received this email because you subscribed to {writerSettings.newsletterName}.
            {unsubscribeUrl && (
              <>
                {' '}
                <Link href={unsubscribeUrl} style={styles.unsubscribeLink}>
                  Unsubscribe
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    backgroundColor: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: '0',
    padding: '0',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700' as const,
    color: '#1a1a1a',
    lineHeight: '1.3',
    margin: '0 0 8px 0',
  },
  byline: {
    fontSize: '15px',
    color: '#6b7280',
    margin: '0 0 32px 0',
  },
  content: {
    color: '#1a1a1a',
  },
  footer: {
    fontSize: '13px',
    color: '#9ca3af',
    marginTop: '48px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
  },
  unsubscribeLink: {
    color: '#9ca3af',
    textDecoration: 'underline',
  },
} as const

export default DynamicDocumentNewsletter
