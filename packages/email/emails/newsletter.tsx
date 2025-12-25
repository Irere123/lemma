import {
  Body,
  Container,
  Heading,
  Img,
  Link,
  Preview,
  Text,
  Hr,
  Markdown,
} from '@react-email/components'
import { EmailThemeProvider, getEmailInlineStyles, getEmailThemeClasses } from '../components/theme'
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
  const themeClasses = getEmailThemeClasses()
  const lightStyles = getEmailInlineStyles('light')

  const previewText =
    document.subtitle || document.title || `New content from ${writerSettings.fromName}`

  const unsubscribeUrl = unsubscribeToken
    ? `${writerSettings.baseUrl}/unsubscribe?token=${unsubscribeToken}&writer=${writerSettings.id}`
    : undefined

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
          {/* Custom Logo or Newsletter Name */}
          {writerSettings.logoUrl ? (
            <Img
              src={writerSettings.logoUrl}
              alt={writerSettings.fromName}
              className='w-full h-auto mb-[30px] max-w-[200px] mx-auto'
            />
          ) : (
            <div className='text-center mb-[30px]'>
              <Heading
                className={`text-[24px] font-bold ${themeClasses.heading}`}
                style={{ color: writerSettings.brandColor }}
              >
                {writerSettings.newsletterName}
              </Heading>
            </div>
          )}

          {document.bannerImage && (
            <Img
              src={document.bannerImage}
              alt={document.title || 'Newsletter banner'}
              className='w-full h-auto mb-[30px] rounded-md'
            />
          )}

          <Heading
            className={`text-[24px] font-bold text-center p-0 my-[30px] mx-0 ${themeClasses.heading}`}
            style={{ color: lightStyles.text.color }}
          >
            {document.title || 'Untitled'}
          </Heading>

          {document.subtitle && (
            <Text
              className={`text-[18px] text-center mb-[20px] ${themeClasses.text}`}
              style={{ color: lightStyles.mutedText.color }}
            >
              {document.subtitle}
            </Text>
          )}

          <Hr
            className='my-[26px]'
            style={{
              borderColor: lightStyles.container.borderColor,
              borderWidth: 1,
            }}
          />

          {document.markdown && (
            <div
              className={`text-base leading-relaxed ${themeClasses.text}`}
              style={{ color: lightStyles.text.color }}
            >
              <Markdown
                markdownCustomStyles={{
                  h1: {
                    fontSize: '24px',
                    fontWeight: 'bold',
                    marginTop: '20px',
                    marginBottom: '10px',
                  },
                  h2: {
                    fontSize: '20px',
                    fontWeight: 'bold',
                    marginTop: '18px',
                    marginBottom: '8px',
                  },
                  h3: {
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginTop: '16px',
                    marginBottom: '6px',
                  },
                  p: {
                    marginTop: '0',
                    marginBottom: '16px',
                    lineHeight: '1.6',
                  },
                  blockQuote: {
                    borderLeft: '4px solid #ddd',
                    paddingLeft: '16px',
                    marginLeft: '0',
                    marginBottom: '16px',
                    color: '#666',
                  },
                }}
                markdownContainerStyles={{
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  lineHeight: '1.6',
                }}
              >
                {document.markdown}
              </Markdown>
            </div>
          )}

          <Hr
            className='my-[26px]'
            style={{
              borderColor: lightStyles.container.borderColor,
              borderWidth: 1,
            }}
          />

          {unsubscribeUrl && (
            <Text
              className={`text-xs text-center mt-[20px] ${themeClasses.mutedText}`}
              style={{ color: lightStyles.mutedText.color }}
            >
              You're receiving this email because you subscribed to {writerSettings.newsletterName}{' '}
              ({recipientEmail}).{' '}
              <Link href={unsubscribeUrl} style={{ color: lightStyles.mutedText.color }}>
                Unsubscribe
              </Link>
            </Text>
          )}
        </Container>
      </Body>
    </EmailThemeProvider>
  )
}

export default DynamicDocumentNewsletter
