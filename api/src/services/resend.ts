import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
export interface ResendEmailProps {
  to: string;
  subject: string;
  body: string;
  from: string;
  fromEmail?: string;
}

export const nameToEmail = (name: string) => {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@${process.env.RESEND_DOMAIN}`;
};

export const sendTextEmail = async ({
  body,
  from,
  subject,
  to,
  fromEmail,
}: ResendEmailProps) => {
  fromEmail = fromEmail
    ? `${fromEmail}@${process.env.RESEND_DOMAIN}`
    : nameToEmail(from);

  try {
    console.log(`Sending email to ${to} with subject ${subject}`);
    const { data, error } = await resend.emails.send({
      from: `${from} <${fromEmail}>`,
      to: to,
      subject: subject,
      text: body,
    });

    if (error) {
      console.log(error);
    }
    return data;
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
    ? `${fromEmail}@${process.env.RESEND_DOMAIN}`
    : nameToEmail(from);

  await resend.emails.send({
    from: `${from} <${fromEmail}>`,
    to: to,
    subject: subject,
    html: body,
  });
};
