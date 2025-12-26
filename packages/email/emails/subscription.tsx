import { Body, Container, Head, Html, Link, Preview, Text } from '@react-email/components'
import type { NewsletterSettings } from '../types'

interface Props {
  writerSettings: NewsletterSettings
  token?: string
}

export const NewsletterSubscriptionEmail = ({ writerSettings, token }: Props) => {
  const confirmUrl = token && writerSettings.confirmationUrl
    ? `${writerSettings.confirmationUrl}/?token=${token}&writer=${writerSettings.id}`
    : null

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>Confirm your subscription to {writerSettings.newsletterName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.greeting}>
            Hey,
          </Text>

          <Text style={styles.paragraph}>
            Thanks for subscribing to <strong>{writerSettings.newsletterName}</strong>.
          </Text>

          <Text style={styles.paragraph}>
            I'm {writerSettings.fromName}, and I'm excited to have you here.
          </Text>

          {confirmUrl && (
            <>
              <Text style={styles.paragraph}>
                Please confirm your email to start receiving updates:
              </Text>

              <Text style={styles.paragraph}>
                <Link href={confirmUrl} style={styles.link}>
                  Confirm your subscription
                </Link>
              </Text>
            </>
          )}

          <Text style={styles.signoff}>
            — {writerSettings.fromName}
          </Text>

          <Text style={styles.footer}>
            If you didn't subscribe to this newsletter, you can safely ignore this email.
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
  greeting: {
    fontSize: '17px',
    color: '#1a1a1a',
    lineHeight: '1.7',
    margin: '0 0 20px 0',
  },
  paragraph: {
    fontSize: '17px',
    color: '#1a1a1a',
    lineHeight: '1.7',
    margin: '0 0 20px 0',
  },
  link: {
    color: '#0969da',
    textDecoration: 'underline',
  },
  signoff: {
    fontSize: '17px',
    color: '#1a1a1a',
    lineHeight: '1.7',
    margin: '32px 0 0 0',
  },
  footer: {
    fontSize: '13px',
    color: '#9ca3af',
    marginTop: '48px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
  },
} as const

export default NewsletterSubscriptionEmail
