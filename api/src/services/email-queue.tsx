import { Resend } from "resend";
import type { NewsletterSettings } from "@api/db/schema";
import { createEmailQueueClient } from "../queue/bindings";
import type { EnqueueOptions } from "../queue/types";

export type EmailTemplate = "welcome-newsletter" | "document-newsletter";

export type DocumentData = {
  id: string;
  title: string | null;
  subtitle: string | null;
  markdown: string | null;
  bannerImage: string | null;
  publishedDate: Date | null;
};

export type EmailTemplateProps = {
  "welcome-newsletter": {
    writerSettings: NewsletterSettings;
    token?: string;
  };
  "document-newsletter": {
    document: DocumentData;
    writerSettings: NewsletterSettings;
    recipientEmail: string;
    unsubscribeToken?: string;
  };
};

export type EmailJobPayload<T extends EmailTemplate = EmailTemplate> = {
  template: T;
  to: string;
  subject: string;
  from: string;
  fromEmail?: string;
  props: EmailTemplateProps[T];
};

const QUEUE_NAME = "email";

const renderEmailTemplate = async (template: EmailTemplate, props: any) => {
  switch (template) {
    case "welcome-newsletter": {
      const { default: DynamicWelcomeNewsletter } = await import(
        "@brain/email/emails/dynamic-welcome-newsletter"
      );

      return DynamicWelcomeNewsletter(props);
    }
    case "document-newsletter": {
      const { default: DynamicDocumentNewsletter } = await import(
        "@brain/email/emails/dynamic-document-newsletter"
      );
      return DynamicDocumentNewsletter(props);
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
};

export const enqueueEmailJob = async <T extends EmailTemplate>(
  env: Env,
  payload: EmailJobPayload<T>,
  options?: EnqueueOptions
) => {
  const client = createEmailQueueClient(env);

  const result = await client.enqueue(QUEUE_NAME, payload, {
    maxAttempts: 5,
    priority: 5,
    backoffSettings: {
      strategy: "exponential",
      delayMs: 1000,
      maxDelayMs: 60000,
      factor: 2,
    },
    ...options,
  });

  return result;
};

export const processEmailJobs = async (env: Env, batchSize = 10) => {
  const client = createEmailQueueClient(env);
  const resend = new Resend(env.RESEND_API_KEY);

  const jobs = await client.claim<EmailJobPayload>(QUEUE_NAME, batchSize);

  const results = [];

  for (const job of jobs) {
    try {
      const { template, to, subject, from, fromEmail, props } = job.data;

      // Get the React email component
      const emailComponent = await renderEmailTemplate(template, props);

      // Send email via Resend - pass the React element directly
      if (fromEmail) {
        await resend.emails.send({
          from: fromEmail,
          to,
          subject,
          react: emailComponent,
        });
      } else {
        await resend.emails.send({
          from: from,
          to,
          subject,
          react: emailComponent,
        });
      }

      await client.complete(QUEUE_NAME, job.id, job.leaseToken!);

      results.push({
        jobId: job.id,
        status: "completed" as const,
        template,
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown error occurred";

      await client.fail(QUEUE_NAME, job.id, job.leaseToken!, reason);

      results.push({
        jobId: job.id,
        status: "failed" as const,
        reason,
      });
    }
  }

  return results;
};

export const processDelayedEmailJobs = async (env: Env) => {
  const client = createEmailQueueClient(env);
  const moved = await client.processDelayedJobs(QUEUE_NAME);

  return { moved };
};

export const getEmailQueueStats = async (env: Env) => {
  const client = createEmailQueueClient(env);
  const stats = await client.getStats(QUEUE_NAME);

  return stats;
};

// Helper function to enqueue document newsletter
export const enqueueDocumentNewsletter = async (
  env: Env,
  document: DocumentData,
  writerSettings: NewsletterSettings,
  recipients: Array<{ email: string; unsubscribeToken?: string }>,
  options?: EnqueueOptions
) => {
  const results = [];

  for (const recipient of recipients) {
    const result = await enqueueEmailJob(
      env,
      {
        template: "document-newsletter",
        to: recipient.email,
        subject: document.title || "New Newsletter from irere.dev",
        from: "Irere Emmanuel",
        fromEmail: "newsletter",
        props: {
          document,
          recipientEmail: recipient.email,
          unsubscribeToken: recipient.unsubscribeToken,
          writerSettings,
        },
      },
      options
    );

    results.push({
      email: recipient.email,
      jobId: result.job.id,
    });
  }

  return results;
};

// Helper function to enqueue welcome newsletter
export const enqueueWelcomeNewsletter = async (
  env: Env,
  email: string,
  writerSettings: NewsletterSettings,
  token?: string,
  options?: EnqueueOptions
) => {
  return enqueueEmailJob(
    env,
    {
      template: "welcome-newsletter",
      to: email,
      subject: `Welcome to ${writerSettings.newsletterName}`,
      from: writerSettings.fromName,
      fromEmail: `${writerSettings.fromName
        .toLowerCase()
        .replace(/\s+/g, ".")}@${env.RESEND_DOMAIN}`,
      props: {
        token,
        writerSettings,
      },
    },
    options
  );
};
