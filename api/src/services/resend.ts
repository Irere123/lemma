import { Resend } from "resend";
import { env } from "cloudflare:workers";

export const resend = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : { emails: { send: async (...args: unknown[]) => console.log(args) } };
export interface ResendEmailProps {
  to: string;
  subject: string;
  body: string;
  from: string;
  fromEmail?: string;
}

export const nameToEmail = (name: string) => {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@${env.RESEND_DOMAIN}`;
};

export const sendTextEmail = async ({
  body,
  from,
  subject,
  to,
  fromEmail,
}: ResendEmailProps) => {
  fromEmail = fromEmail
    ? `${fromEmail}@${env.RESEND_DOMAIN}`
    : nameToEmail(from);

  try {
    console.log(`Sending email to ${to} with subject ${subject}`);

    await resend.emails.send({
      from: `${from} <${fromEmail}>`,
      to: to,
      subject: subject,
      text: body,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const sendHtmlEmail = async ({
  body,
  from,
  subject,
  to,
  fromEmail,
}: ResendEmailProps) => {
  fromEmail = fromEmail
    ? `${fromEmail}@${env.RESEND_DOMAIN}`
    : nameToEmail(from);

  await resend.emails.send({
    from: `${from} <${fromEmail}>`,
    to: to,
    subject: subject,
    html: body,
  });
};
