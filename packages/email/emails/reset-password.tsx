import { Body, Container, Head, Html, Link, Preview, Text } from '@react-email/components'

interface Props {
  user: {
    name?: string | null
    email: string
  }
  url: string
  token?: string
  baseUrl?: string
}

export const ResetPassword = ({ user, url }: Props) => {
  const userName = user.name || 'there'
  const previewText = 'Reset your password'

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.paragraph}>
            Hello {userName},
          </Text>

          <Text style={styles.paragraph}>
            We received a request to reset your password. Click the link below to choose a new one:
          </Text>

          <Text style={styles.paragraph}>
            <Link href={url} style={styles.link}>
              Reset your password
            </Link>
          </Text>

          <Text style={styles.muted}>
            Or copy and paste this URL into your browser:
          </Text>
          <Text style={styles.urlText}>
            {url}
          </Text>

          <Text style={styles.paragraph}>
            This link will expire in 1 hour.
          </Text>

          <Text style={styles.footer}>
            If you didn't request a password reset, you can safely ignore this email.
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
  muted: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 8px 0',
  },
  urlText: {
    fontSize: '14px',
    color: '#6b7280',
    wordBreak: 'break-all' as const,
    margin: '0 0 20px 0',
  },
  footer: {
    fontSize: '13px',
    color: '#9ca3af',
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
  },
} as const

export default ResetPassword
