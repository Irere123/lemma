import { Column, Hr, Img, Link, Row, Section, Text } from '@react-email/components'

import { baseUrl } from '../lib/constants'
import { LogoFooter } from './logo-footer'
import { getEmailInlineStyles, getEmailThemeClasses } from './theme'

interface FooterProps {
  unsubscribeUrl?: string
  customFooterText?: string | null
}

export function Footer({ unsubscribeUrl, customFooterText }: FooterProps = {}) {
  const themeClasses = getEmailThemeClasses()
  const lightStyles = getEmailInlineStyles('light')

  return (
    <Section className='w-full'>
      <Hr
        className={themeClasses.border}
        style={{ borderColor: lightStyles.container.borderColor }}
      />
      <br />

      <br />
      <Row>
        <Column className='align-middle w-[40px]'>
          <Link href='https://irere.dev/Ct3xybK'>
            <Img src={`${baseUrl}/email/x.png`} width='18' height='18' alt='Midday on X' />
          </Link>
        </Column>
        <Column className='align-middle w-[40px]'>
          <Link href='https://irere.dev/Ct3xybK'>
            <Img
              src={`${baseUrl}/email/producthunt.png`}
              width='22'
              height='22'
              alt='Midday on Producthunt'
            />
          </Link>
        </Column>
        <Column className='align-middle'>
          <Link href='https://irere.dev/Ct3xybK'>
            <Img
              src={`${baseUrl}/email/linkedin.png`}
              width='22'
              height='22'
              alt='Midday on LinkedIn'
            />
          </Link>
        </Column>
      </Row>
      <br />
      <br />
      <Text
        className={`text-xs ${themeClasses.secondaryText}`}
        style={{ color: lightStyles.secondaryText.color }}
      >
        {customFooterText || 'Irere Emmanuel - Kigali, Rwanda.'}
      </Text>
      <Link
        className={`text-[14px] block ${themeClasses.mutedLink}`}
        href={unsubscribeUrl || 'https://irere.dev/unsubscribe'}
        title='Unsubscribe'
        style={{ color: lightStyles.mutedText.color }}
      >
        Unsubscribe
      </Link>
      <br />
      <br />
      <LogoFooter />
    </Section>
  )
}
