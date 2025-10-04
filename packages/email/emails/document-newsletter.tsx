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
} from "@react-email/components";
import { Footer } from "../components/footer";
import { Logo } from "../components/logo";
import {
  EmailThemeProvider,
  getEmailInlineStyles,
  getEmailThemeClasses,
} from "../components/theme";
import { baseUrl } from "../lib/constants";

interface DocumentData {
  id: string;
  title: string | null;
  subtitle: string | null;
  type: "ARTICLE" | "NEWSLETTER" | "NOTE" | null;
  markdown: string | null;
  bannerImage: string | null;
  publishedDate: Date | null;
}

interface Props {
  document: DocumentData;
  recipientEmail: string;
  unsubscribeToken?: string;
}

export const DocumentNewsletter = ({
  document,
  recipientEmail,
  unsubscribeToken,
}: Props) => {
  const themeClasses = getEmailThemeClasses();
  const lightStyles = getEmailInlineStyles("light");

  const previewText =
    document.subtitle ||
    document.title ||
    "New content from irere.dev newsletter";

  const documentUrl = `${baseUrl}/posts/${document.id}`;
  const unsubscribeUrl = unsubscribeToken
    ? `${baseUrl}/unsubscribe?token=${unsubscribeToken}`
    : undefined;

  return (
    <EmailThemeProvider preview={<Preview>{previewText}</Preview>}>
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
          <Logo />

          {document.bannerImage && (
            <Img
              src={document.bannerImage}
              alt={document.title || "Newsletter banner"}
              className="w-full h-auto mb-[30px] rounded-md"
            />
          )}

          <Heading
            className={`text-[24px] font-bold text-center p-0 my-[30px] mx-0 ${themeClasses.heading}`}
            style={{ color: lightStyles.text.color }}
          >
            {document.title || "Untitled"}
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
            className="my-[26px]"
            style={{
              borderColor: lightStyles.container.borderColor,
              borderWidth: 1,
            }}
          />

          {document.markdown ? (
            <div
              className={`text-base leading-relaxed ${themeClasses.text}`}
              style={{ color: lightStyles.text.color }}
            >
              <Markdown
                markdownCustomStyles={{
                  h1: {
                    fontSize: "24px",
                    fontWeight: "bold",
                    marginTop: "20px",
                    marginBottom: "10px",
                  },
                  h2: {
                    fontSize: "20px",
                    fontWeight: "bold",
                    marginTop: "18px",
                    marginBottom: "8px",
                  },
                  h3: {
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginTop: "16px",
                    marginBottom: "6px",
                  },
                  p: {
                    marginTop: "0",
                    marginBottom: "16px",
                    lineHeight: "1.6",
                  },
                  blockQuote: {
                    borderLeft: "4px solid #ddd",
                    paddingLeft: "16px",
                    marginLeft: "0",
                    marginBottom: "16px",
                    color: "#666",
                  },
                }}
                markdownContainerStyles={{
                  fontFamily: "inherit",
                  fontSize: "16px",
                  lineHeight: "1.6",
                }}
              >
                {document.markdown.length > 1500
                  ? document.markdown.slice(0, 1500) + "\n\n..."
                  : document.markdown}
              </Markdown>
            </div>
          ) : (
            <Text
              className={`text-base leading-relaxed ${themeClasses.text}`}
              style={{ color: lightStyles.text.color }}
            >
              Read the full article on our website.
            </Text>
          )}

          <Link
            href={documentUrl}
            className={`block text-center my-[32px] p-[12px_24px] bg-black text-white rounded-md text-sm font-medium no-underline ${themeClasses.button}`}
            style={{ backgroundColor: "#000", color: "#fff" }}
          >
            read full article
          </Link>

          <Hr
            className="my-[26px]"
            style={{
              borderColor: lightStyles.container.borderColor,
              borderWidth: 1,
            }}
          />

          <Text
            className={themeClasses.mutedText}
            style={{ color: lightStyles.mutedText.color }}
          >
            — irere
          </Text>

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

          <Img
            src={`${baseUrl}/email/signature.png`}
            alt="Signature"
            className="block w-[143px] h-[20px] signature-blend"
          />

          <br />
          <br />

          <Footer unsubscribeUrl={unsubscribeUrl} />

          {unsubscribeUrl && (
            <Text
              className={`text-xs text-center mt-[20px] ${themeClasses.mutedText}`}
              style={{ color: lightStyles.mutedText.color }}
            >
              You're receiving this email because you subscribed to{" "}
              {recipientEmail}.{" "}
              <Link
                href={unsubscribeUrl}
                style={{ color: lightStyles.mutedText.color }}
              >
                Unsubscribe
              </Link>
            </Text>
          )}
        </Container>
      </Body>
    </EmailThemeProvider>
  );
};

export default DocumentNewsletter;
