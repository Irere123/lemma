import { Body, Container, Heading, Hr, Preview, Text } from '@react-email/components'
import { Footer } from '../components/footer'
import { Logo } from '../components/logo'
import { EmailThemeProvider, getEmailInlineStyles, getEmailThemeClasses } from '../components/theme'

interface Props {
  user: {
    name?: string | null
    email: string
  }
  otp: string
  baseUrl?: string
  expiresIn?: number // in minutes
}

export const OTPVerification = ({ user, otp, expiresIn = 10 }: Props) => {
  const themeClasses = getEmailThemeClasses()
  const lightStyles = getEmailInlineStyles('light')

  const userName = user.name || 'there'
  const previewText = `Your verification code is ${otp}`

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
            Verify your account
          </Heading>

          <Text
            className={`text-base ${themeClasses.text}`}
            style={{ color: lightStyles.text.color }}
          >
            Hello {userName},
            <br />
            <br />
            Use the verification code below to complete your verification:
          </Text>

          <div
            style={{
              backgroundColor: lightStyles.container.borderColor,
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'center',
              margin: '24px 0',
            }}
          >
            <Text
              className={`text-[32px] font-bold tracking-widest ${themeClasses.heading}`}
              style={{
                color: lightStyles.text.color,
                margin: 0,
                letterSpacing: '8px',
                fontFamily: 'monospace',
              }}
            >
              {otp}
            </Text>
          </div>

          <Text
            className={`text-sm ${themeClasses.mutedText}`}
            style={{ color: lightStyles.mutedText.color }}
          >
            Enter this code in the verification field to complete your account setup.
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
            This verification code will expire in {expiresIn} minutes. If you didn't request this
            code, you can safely ignore this email.
          </Text>

          <Footer />
        </Container>
      </Body>
    </EmailThemeProvider>
  )
}

export default OTPVerification
