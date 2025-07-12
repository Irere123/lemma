import {
  Body,
  Container,
  Heading,
  Img,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import { Footer } from "../components/footer";
import { Logo } from "../components/logo";
import {
  EmailThemeProvider,
  getEmailInlineStyles,
  getEmailThemeClasses,
} from "../components/theme";
import { baseUrl } from "../lib/constants";

interface Props {
  token?: string;
}

export const WelcomeNewsletter = ({ token }: Props) => {
  const themeClasses = getEmailThemeClasses();
  const lightStyles = getEmailInlineStyles("light");

  return (
    <EmailThemeProvider preview={<Preview>welcome to the newsletter</Preview>}>
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

          <Heading
            className={`text-[21px] font-normal text-center p-0 my-[30px] mx-0 ${themeClasses.heading}`}
            style={{ color: lightStyles.text.color }}
          >
            you're in.
          </Heading>

          <Text
            className={`text-base ${themeClasses.text}`}
            style={{ color: lightStyles.text.color }}
          >
            hey, i'm irere.
            <br />
            <br />
            welcome to my newsletter — a space where i share ideas, tools,
            experiments, and honest thoughts around building and thinking
            better.
            <br />
            <br />
            this newsletter is more than just a writing — it’s a way to operate.
            you'll get updates, systems i’m testing, and frameworks that might
            help you move a bit faster and think a bit clearer.
            <br />
            <br />
            before we go further, confirm your email to stay in the loop.
          </Text>

          {token && (
            <Link
              href={`${baseUrl}/verify?token=${token}`}
              className={`my-[24px] p-[12px_24px] bg-black text-white rounded-md text-sm font-medium ${themeClasses.button}`}
              style={{ backgroundColor: "#000", color: "#fff" }}
            >
              verify your email
            </Link>
          )}

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

          <Footer />
        </Container>
      </Body>
    </EmailThemeProvider>
  );
};

export default WelcomeNewsletter;
