import type { WorkerEnv } from "../queue/bindings.ts";
import { createEmailQueueClient } from "../queue/bindings.ts";
import type { EnqueueOptions } from "../queue/types.ts";
import { resend } from "./resend.ts";
import { render } from "@react-email/render";
import { createElement } from "react";

export type EmailTemplate = "welcome-newsletter" | "document-newsletter";

export type DocumentData = {
  id: string;
  title: string | null;
  subtitle: string | null;
  type: "ARTICLE" | "NEWSLETTER" | "NOTE" | null;
  markdown: string | null;
  bannerImage: string | null;
  publishedDate: Date | null;
};

export type EmailTemplateProps = {
  "welcome-newsletter": {
    token?: string;
  };
  "document-newsletter": {
    document: DocumentData;
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

const renderEmailTemplate = async (
  template: EmailTemplate,
  props: any
): Promise<string> => {
  switch (template) {
    case "welcome-newsletter": {
      const WelcomeNewsletter = (
        await import("@brain/email/emails/welcome-newsletter")
      ).default;
      return render(createElement(WelcomeNewsletter, props));
    }
    case "document-newsletter": {
      const DocumentNewsletter = (
        await import("@brain/email/emails/document-newsletter")
      ).default;
      return render(createElement(DocumentNewsletter, props));
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
};

export const enqueueEmailJob = async <T extends EmailTemplate>(
  env: WorkerEnv,
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

export const processEmailJobs = async (env: WorkerEnv, batchSize = 10) => {
  const client = createEmailQueueClient(env);

  const jobs = await client.claim<EmailJobPayload>(QUEUE_NAME, batchSize);

  const results = [];

  for (const job of jobs) {
    try {
      const { template, to, subject, from, fromEmail, props } = job.data;

      // Render the email template
      const html = await renderEmailTemplate(template, props);

      // Prepare from address
      const fromAddress = fromEmail
        ? `${from} <${fromEmail}@${process.env.RESEND_DOMAIN || "irere.dev"}>`
        : `${from} <no-reply@${process.env.RESEND_DOMAIN || "irere.dev"}>`;

      // Send email via Resend
      await resend.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
      });

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

export const processDelayedEmailJobs = async (env: WorkerEnv) => {
  const client = createEmailQueueClient(env);
  const moved = await client.processDelayedJobs(QUEUE_NAME);

  return { moved };
};

export const getEmailQueueStats = async (env: WorkerEnv) => {
  const client = createEmailQueueClient(env);
  const stats = await client.getStats(QUEUE_NAME);

  return stats;
};

// Helper function to enqueue document newsletter
export const enqueueDocumentNewsletter = async (
  env: WorkerEnv,
  document: DocumentData,
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
  env: WorkerEnv,
  email: string,
  token?: string,
  options?: EnqueueOptions
) => {
  return enqueueEmailJob(
    env,
    {
      template: "welcome-newsletter",
      to: email,
      subject: "Welcome to the newsletter",
      from: "Irere Emmanuel",
      fromEmail: "newsletter",
      props: {
        token,
      },
    },
    options
  );
};
