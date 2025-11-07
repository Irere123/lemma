import {
  Body,
  Container,
  Heading,
  Img,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import {
  EmailThemeProvider,
  getEmailInlineStyles,
  getEmailThemeClasses,
} from "../components/theme";
import { baseUrl } from "../lib/constants";

interface WriterNewsletterSettings {
  id: string;
  newsletterName: string;
  fromName: string;
  logoUrl: string | null;
  brandColor: string | null;
}

interface Props {
  writerSettings: WriterNewsletterSettings;
  token?: string;
}

export const NewsletterSubscriptionEmail = ({
  writerSettings,
  token,
}: Props) => {
  const themeClasses = getEmailThemeClasses();
  const lightStyles = getEmailInlineStyles("light");

  return (
    <EmailThemeProvider
      preview={<Preview>welcome to {writerSettings.newsletterName}</Preview>}
    >
      <Body
        className={`my-auto mx-auto font-sans ${themeClasses.body}`}
        style={lightStyles.body}
      >
        <Container
          className={`my-[40px] mx-auto p-[20px] max-w-[600px] ${themeClasses.container}`}
          style={{
            borderStyle: "solid",
            borderWidth: 1,
            borderColor: lightStyles.container.borderColor,
          }}
        >
          {/* Custom Logo or Newsletter Name */}
          {writerSettings.logoUrl ? (
            <Img
              src={writerSettings.logoUrl}
              alt={writerSettings.newsletterName}
              className="w-full h-auto mb-[30px] max-w-[200px] mx-auto"
            />
          ) : (
            <div className="text-center mb-[30px]">
              <Heading
                className={`text-[24px] font-bold ${themeClasses.heading}`}
                style={{ color: writerSettings.brandColor ?? undefined }}
              >
                {writerSettings.newsletterName}
              </Heading>
            </div>
          )}

          <Heading
            className={`text-[21px] font-normal text-center p-0 my-[30px] mx-0 ${themeClasses.heading}`}
            style={{ color: lightStyles.text.color }}
          >
            You're in.
          </Heading>

          <Text
            className={`text-base ${themeClasses.text}`}
            style={{ color: lightStyles.text.color }}
          >
            Hey, I'm {writerSettings.fromName}.
            <br />
            <br />
            Welcome to {writerSettings.newsletterName} <br />
            <br />
            This newsletter is more than just writing, it's a way to operate.
            You'll get updates, systems I'm testing, and frameworks that might
            help you move a bit faster and think a bit clearer.
            <br />
            <br />
            Before we go further, confirm your email to stay in the loop.
          </Text>

          {token && (
            <Link
              href={`${baseUrl}/verify?token=${token}&writer=${writerSettings.id}`}
              className={`my-[24px] p-[12px_24px] text-white rounded-md text-sm font-medium ${themeClasses.button}`}
              style={{
                backgroundColor: writerSettings.brandColor ?? undefined,
                color: "#fff",
              }}
            >
              Confirm your email
            </Link>
          )}

          <style>{`
            .signature-blend {
              filter: none;
            }

            @media (prefers-color-scheme: dark) {
              .signature-blend:not([class^="x_"]) {
                filter: invert(1) brightness(1);
              }
            }

            [data-ogsb] .signature-blend,
            [data-ogsc] .signature-blend,
            [data-ogac] .signature-blend,
            [data-ogab] .signature-blend {
              filter: invert(1) brightness(1);
            }
          `}</style>
        </Container>
      </Body>
    </EmailThemeProvider>
  );
};

export default NewsletterSubscriptionEmail;
