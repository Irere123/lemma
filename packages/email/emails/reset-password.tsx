import { Body, Container, Heading, Hr, Link, Preview, Text } from '@react-email/components'
import { Footer } from '../components/footer'
import { Logo } from '../components/logo'
import { EmailThemeProvider, getEmailInlineStyles, getEmailThemeClasses } from '../components/theme'

interface Props {
  user: {
    name?: string | null
    email: string
  }
  url: string
  token?: string
  baseUrl?: string
}

export const ResetPassword = ({ user, url, token, baseUrl }: Props) => {
  const themeClasses = getEmailThemeClasses()
  const lightStyles = getEmailInlineStyles('light')

  const userName = user.name || 'there'
  const previewText = `Reset your password`

  return (
    <EmailThemeProvider preview={<Preview>{previewText}</Preview>}>
      <Body className={`my-auto mx-auto font-sans ${themeClasses.body}`} style={lightStyles.body}>
        <Container
          className={`my-[40px] mx-auto p-[20px] max-w-[600px] ${themeClasses.container}`}
          style={{
            borderStyle: 'solid',
            borderWidth: 1,
            borderColor: lightStyles.container.borderColor,
          }}
        >
          <Logo />

          <Heading
            className={`text-[24px] font-bold text-center p-0 my-[30px] mx-0 ${themeClasses.heading}`}
            style={{ color: lightStyles.text.color }}
          >
            Reset your password
          </Heading>

          <Text
            className={`text-base ${themeClasses.text}`}
            style={{ color: lightStyles.text.color }}
          >
            Hello {userName},
            <br />
            <br />
            We received a request to reset your password. If you didn't make this request, you can
            safely ignore this email.
            <br />
            <br />
            To reset your password, click the button below:
          </Text>

          <Link
            href={url}
            className={`my-[24px] p-[12px_24px] text-white rounded-md text-sm font-medium block text-center ${themeClasses.button}`}
            style={{
              backgroundColor: lightStyles.text.color,
              color: '#fff',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Reset Password
          </Link>

          <Text
            className={`text-sm ${themeClasses.mutedText}`}
            style={{ color: lightStyles.mutedText.color }}
          >
            If the button doesn't work, you can copy and paste this link into your browser:
            <br />
            <Link href={url} style={{ color: lightStyles.text.color, wordBreak: 'break-all' }}>
              {url}
            </Link>
          </Text>

          <Hr
            className='my-[26px]'
            style={{
              borderColor: lightStyles.container.borderColor,
              borderWidth: 1,
            }}
          />

          <Text
            className={`text-xs ${themeClasses.mutedText}`}
            style={{ color: lightStyles.mutedText.color }}
          >
            This password reset link will expire in 1 hour. If you didn't request a password reset,
            you can safely ignore this email and your password will remain unchanged.
          </Text>

          <Footer />
        </Container>
      </Body>
    </EmailThemeProvider>
  )
}

export default ResetPassword
