import { Body, Container, Head, Html, Preview, Text } from '@react-email/components'

interface Props {
  user: {
    name?: string | null
    email: string
  }
  otp: string
  baseUrl?: string
  expiresIn?: number
}

export const OTPVerification = ({ user, otp, expiresIn = 10 }: Props) => {
  const userName = user.name || 'there'
  const previewText = `Your verification code is ${otp}`

  return (
    <Html>
      <Head>
        <meta name='color-scheme' content='light' />
        <meta name='supported-color-schemes' content='light' />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.paragraph}>Hello {userName},</Text>

          <Text style={styles.paragraph}>Use this verification code to complete your sign in:</Text>

          <Text style={styles.code}>{otp}</Text>

          <Text style={styles.paragraph}>This code expires in {expiresIn} minutes.</Text>

          <Text style={styles.footer}>
            If you didn't request this code, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    backgroundColor: '#ffffff',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
  code: {
    fontSize: '32px',
    fontWeight: '700' as const,
    fontFamily: 'ui-monospace, monospace',
    letterSpacing: '6px',
    color: '#1a1a1a',
    backgroundColor: '#f6f8fa',
    padding: '16px 24px',
    borderRadius: '8px',
    textAlign: 'center' as const,
    margin: '24px 0',
    display: 'block',
  },
  footer: {
    fontSize: '13px',
    color: '#9ca3af',
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
  },
} as const

export default OTPVerification
