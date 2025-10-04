# Email Queue Service with React Email Templates

Fully integrated email queue system using Resend and React Email templates from `@brain/email`.

## Features

- ✅ React Email template rendering
- ✅ Document newsletter support with document schema integration
- ✅ Welcome newsletter with verification tokens
- ✅ Automatic retry with exponential backoff
- ✅ Unsubscribe token support
- ✅ Multiple recipient batching

## Available Templates

### 1. Welcome Newsletter (`welcome-newsletter.tsx`)

Sends a welcome email to new subscribers with optional email verification.

**Props:**

```typescript
{
  token?: string; // Email verification token
}
```

**Usage:**

```typescript
import { enqueueWelcomeNewsletter } from "./services/email-queue";

await enqueueWelcomeNewsletter(env, "user@example.com", "verification-token");
```

### 2. Document Newsletter (`document-newsletter.tsx`)

Sends newsletter content from the documents schema with rich formatting.

**Props:**

```typescript
{
  document: DocumentData; // From documents schema
  recipientEmail: string; // Recipient's email
  unsubscribeToken?: string; // Token for unsubscribe link
}
```

**Document Schema Fields:**

- `id`: Document identifier
- `title`: Newsletter title
- `subtitle`: Newsletter subtitle
- `type`: "ARTICLE" | "NEWSLETTER" | "NOTE"
- `markdown`: Full content in markdown
- `bannerImage`: Header image URL
- `publishedDate`: Publication date

**Usage:**

```typescript
import { enqueueDocumentNewsletter } from "./services/email-queue";

const document = {
  id: "doc-123",
  title: "Weekly Update",
  subtitle: "What's new this week",
  type: "NEWSLETTER",
  markdown: "# Content here...",
  bannerImage: "https://example.com/image.jpg",
  publishedDate: new Date(),
};

const recipients = [
  { email: "user1@example.com", unsubscribeToken: "token-1" },
  { email: "user2@example.com", unsubscribeToken: "token-2" },
];

await enqueueDocumentNewsletter(env, document, recipients);
```

## Processing Jobs

Set up a cron trigger or manual endpoint to process queued emails:

```typescript
import {
  processEmailJobs,
  processDelayedEmailJobs,
} from "./services/email-queue";

// Process up to 50 emails
const results = await processEmailJobs(env, 50);

// Process delayed jobs (retry + scheduled)
await processDelayedEmailJobs(env);
```

## Queue Statistics

Monitor your email queue:

```typescript
import { getEmailQueueStats } from "./services/email-queue";

const stats = await getEmailQueueStats(env);
// {
//   waiting: 10,    // Ready to send
//   active: 2,      // Currently processing
//   delayed: 5,     // Scheduled/retry
//   failed: 1       // In dead letter queue
// }
```

## Configuration

### Environment Variables

Set these in `wrangler.jsonc` or `.dev.vars`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_DOMAIN=irere.dev
```

### Queue Options

Customize retry behavior when enqueueing:

```typescript
await enqueueEmailJob(env, payload, {
  priority: 5, // 0-99, higher = higher priority
  delayMs: 5000, // Delay before sending
  maxAttempts: 5, // Max retry attempts
  backoffSettings: {
    strategy: "exponential",
    delayMs: 1000,
    maxDelayMs: 60000,
    factor: 2,
  },
});
```

## Adding New Templates

1. Create template in `packages/email/emails/your-template.tsx`
2. Add template type to `EmailTemplate` union
3. Add props to `EmailTemplateProps` interface
4. Add case to `renderEmailTemplate` switch statement
5. Create helper function (optional)

Example:

```typescript
// 1. Add to types
export type EmailTemplate = "welcome-newsletter" | "document-newsletter" | "your-template";

// 2. Add props
export type EmailTemplateProps = {
  "your-template": {
    // Your props here
  };
};

// 3. Add to renderEmailTemplate
case "your-template": {
  const YourTemplate = (await import("@brain/email/emails/your-template")).default;
  return render(createElement(YourTemplate, props));
}

// 4. Create helper
export const enqueueYourTemplate = async (env, data, options) => {
  return enqueueEmailJob(env, {
    template: "your-template",
    to: data.email,
    subject: "Your Subject",
    from: "Your Name",
    props: data,
  }, options);
};
```

## Error Handling

Failed emails automatically retry with exponential backoff. After `maxAttempts`, they move to the dead letter queue where you can:

- Inspect failed jobs via `getEmailQueueStats`
- Manually retry with custom logic
- Alert on persistent failures

## Performance Tips

- Batch recipients when sending the same content
- Use appropriate priority levels (5 = normal, 9 = urgent, 1 = low)
- Process jobs regularly (e.g., every 1-5 minutes via cron)
- Monitor queue stats to prevent backlog
