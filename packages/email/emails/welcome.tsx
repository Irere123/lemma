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
import { baseUrl } from "lib/constants";

interface Props {
  token: string;
}

export const WelcomeEmail = ({ token = "tk----" }: Props) => {
  const text = `hey, welcome to brainOS – we're glad you're here!`;
  const themeClasses = getEmailThemeClasses();
  const lightStyles = getEmailInlineStyles("light");

  return (
    <EmailThemeProvider preview={<Preview>{text}</Preview>}>
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
            welcome aboard
          </Heading>

          <br />

          <span
            className={`font-medium ${themeClasses.text}`}
            style={{ color: lightStyles.text.color }}
          >
            helllo,
          </span>

          <Text
            className={themeClasses.text}
            style={{ color: lightStyles.text.color }}
          >
            welcome to brainOS – i’m irere emmanuel, the one who built it.
            <br />
            <br />
            brainOS was designed to help you think clearer, stay organized, and
            move faster. it’s a tool i wish i had earlier, so i made it real.
            <br />
            <br />
            take your time exploring. the system is flexible, so make it yours.
            and if you ever want to chat, you can{" "}
            <Link
              href="https://cal.com/idee8"
              className={`underline ${themeClasses.link}`}
              style={{ color: lightStyles.text.color }}
            >
              book a call here
            </Link>
            .<br />
            <br />
            questions, feedback, or random thoughts? just reply – i read every
            message.
          </Text>

          <br />

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

export default WelcomeEmail;
