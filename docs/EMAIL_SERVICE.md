# Email Service Documentation

Complete guide to the email service built on React Email templates and the job queue system.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Email Templates](#email-templates)
- [Sending Emails](#sending-emails)
- [Processing Jobs](#processing-jobs)
- [Adding Templates](#adding-templates)
- [Resend Integration](#resend-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The email service provides:

- **Template-based emails**: Write emails in React/JSX
- **Type-safe props**: TypeScript ensures correct data
- **Automatic queueing**: Reliable delivery with retries
- **Batch sending**: Send to multiple recipients efficiently
- **Unsubscribe support**: Built-in unsubscribe links
- **Preview during development**: See emails before sending

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Email Service Flow                   │
└──────────────────────────────────────────────────┘

1. Application Code
   │
   └─► enqueueDocumentNewsletter(env, document, recipients)
       │
       ▼
2. For each recipient:
   │
   └─► enqueueEmailJob(env, {
         template: "document-newsletter",
         to: recipient.email,
         props: { document, ... },
       })
       │
       └─► QueueClient.enqueue()
           │
           └─► Job stored in Durable Object

3. Cron/Manual Trigger
   │
   └─► processEmailJobs(env, batchSize)
       │
       ├─► QueueClient.claim(batchSize)
       │   └─► Returns array of jobs
       │
       └─► For each job:
           │
           ├─► renderEmailTemplate(template, props)
           │   │
           │   ├─► Import React component
           │   │
           │   ├─► createElement(Component, props)
           │   │
           │   └─► render() → HTML string
           │
           ├─► resend.emails.send({ html, ... })
           │   │
           │   ├─► Success → QueueClient.complete()
           │   │
           │   └─► Error → QueueClient.fail()
           │       │
           │       └─► Retry with backoff
           │
           └─► Return results
```

## Email Templates

### Available Templates

#### 1. Welcome Newsletter

**File**: `packages/email/emails/welcome-newsletter.tsx`

Welcome email sent to new subscribers with optional email verification.

**Props**:

```typescript
{
  token?: string;  // Email verification token
}
```

**Features**:

- Verification button (if token provided)
- Personal welcome message
- Newsletter introduction
- Signature with branding

**Visual Structure**:

```
┌────────────────────────┐
│         Logo           │
├────────────────────────┤
│                        │
│    you're in.          │
│                        │
│    hey, i'm irere.     │
│    welcome to my...    │
│                        │
│  [verify your email]   │
│                        │
│    — irere             │
│    [signature image]   │
│                        │
│    [Footer Links]      │
└────────────────────────┘
```

#### 2. Document Newsletter

**File**: `packages/email/emails/document-newsletter.tsx`

Newsletter email with content from the documents schema.

**Props**:

```typescript
{
  document: {
    id: string;
    title: string | null;
    subtitle: string | null;
    type: "ARTICLE" | "NEWSLETTER" | "NOTE" | null;
    markdown: string | null;
    bannerImage: string | null;
    publishedDate: Date | null;
  };
  recipientEmail: string;
  unsubscribeToken?: string;
}
```

**Features**:

- Banner image display
- Title and subtitle
- Content preview (first 500 characters)
- "Read full article" CTA button
- Unsubscribe link support
- Signature with branding

**Visual Structure**:

```
┌────────────────────────┐
│         Logo           │
├────────────────────────┤
│  [Banner Image]        │
│                        │
│    Article Title       │
│    Subtitle text       │
│                        │
│  ─────────────────     │
│                        │
│  Content preview...    │
│  First 500 chars of    │
│  markdown content...   │
│                        │
│  [read full article]   │
│                        │
│  ─────────────────     │
│                        │
│    — irere             │
│    [signature image]   │
│                        │
│    [Footer Links]      │
│    [Unsubscribe]       │
└────────────────────────┘
```

### Template Components

Shared components in `packages/email/components/`:

**Logo** (`logo.tsx`):

- Brand logo at top of emails
- Links to main website

**Footer** (`footer.tsx`):

- Social media links
- Address information
- Unsubscribe link (optional)

**Theme** (`theme.tsx`):

- Consistent styling across emails
- Light/dark mode support
- Email-safe CSS

## Sending Emails

### Welcome Newsletter

**Use Case**: New user signs up or subscribes

```typescript
import { enqueueWelcomeNewsletter } from "./services/email-queue";

// With verification
await enqueueWelcomeNewsletter(
  env,
  "user@example.com",
  "verification-token-abc123"
);

// Without verification
await enqueueWelcomeNewsletter(env, "user@example.com");
```

**With Options**:

```typescript
await enqueueWelcomeNewsletter(env, "user@example.com", "token-123", {
  priority: 9, // High priority
  delayMs: 0, // Send immediately
  maxAttempts: 5, // Retry up to 5 times
});
```

### Document Newsletter

**Use Case**: Publishing a new article or newsletter

```typescript
import { enqueueDocumentNewsletter } from "./services/email-queue";

// Get document from database
const document = await db.query.documents.findFirst({
  where: eq(documents.id, documentId),
});

// Get subscribers
const subscribers = await db.query.subscribers.findMany({
  where: and(
    eq(subscribers.isConfirmed, true),
    eq(subscribers.isUnsubscribed, false)
  ),
});

// Prepare recipients
const recipients = subscribers.map((sub) => ({
  email: sub.email,
  unsubscribeToken: sub.token,
}));

// Enqueue emails
const results = await enqueueDocumentNewsletter(
  env,
  {
    id: document.id,
    title: document.title,
    subtitle: document.subtitle,
    type: document.type,
    markdown: document.markdown,
    bannerImage: document.bannerImage,
    publishedDate: document.publishedDate,
  },
  recipients
);

console.log(`Enqueued ${results.length} emails`);
```

### Custom Email Job

For advanced use cases:

```typescript
import { enqueueEmailJob } from "./services/email-queue";

await enqueueEmailJob(
  env,
  {
    template: "document-newsletter",
    to: "user@example.com",
    subject: "Custom Subject Line",
    from: "Custom Name",
    fromEmail: "custom", // custom@irere.dev
    props: {
      document: documentData,
      recipientEmail: "user@example.com",
      unsubscribeToken: "token-xyz",
    },
  },
  {
    priority: 5,
    maxAttempts: 3,
    backoffSettings: {
      strategy: "exponential",
      delayMs: 2000,
      maxDelayMs: 120000,
    },
  }
);
```

## Processing Jobs

### Manual Processing

```typescript
import { processEmailJobs } from "./services/email-queue";

// Process up to 50 emails
const results = await processEmailJobs(env, 50);

for (const result of results) {
  if (result.status === "completed") {
    console.log(`✓ Sent email ${result.jobId}`);
  } else {
    console.error(`✗ Failed ${result.jobId}: ${result.reason}`);
  }
}
```

### Cron Trigger

**File**: `api/src/index.ts` (add scheduled handler)

```typescript
export default {
  fetch: app.fetch,

  // Process emails every 5 minutes
  async scheduled(event, env, ctx) {
    if (event.cron === "*/5 * * * *") {
      console.log("Processing email jobs...");

      const results = await processEmailJobs(env, 100);

      console.log(`Processed ${results.length} emails`);
      console.log(
        `Completed: ${results.filter((r) => r.status === "completed").length}`
      );
      console.log(
        `Failed: ${results.filter((r) => r.status === "failed").length}`
      );

      // Process delayed jobs (retries)
      const { moved } = await processDelayedEmailJobs(env);
      console.log(`Promoted ${moved} delayed jobs`);
    }
  },
};
```

**Wrangler Configuration**:

```jsonc
{
  "triggers": {
    "crons": ["*/5 * * * *"], // Every 5 minutes
  },
}
```

### HTTP Endpoint (Manual Trigger)

```typescript
import { Hono } from "hono";
import { processEmailJobs } from "./services/email-queue";

const app = new Hono();

app.post("/api/internal/process-emails", async (c) => {
  // Verify internal auth token
  const token = c.req.header("X-Internal-Token");
  if (token !== c.env.INTERNAL_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const batchSize = parseInt(c.req.query("batch") || "50");
  const results = await processEmailJobs(c.env, batchSize);

  return c.json({
    processed: results.length,
    completed: results.filter((r) => r.status === "completed").length,
    failed: results.filter((r) => r.status === "failed").length,
  });
});
```

## Adding Templates

### Step 1: Create Template Component

**File**: `packages/email/emails/your-template.tsx`

```typescript
import {
  Body,
  Container,
  Heading,
  Text,
  Link,
  Preview,
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
  userName: string;
  actionUrl: string;
}

export const YourTemplate = ({ userName, actionUrl }: Props) => {
  const themeClasses = getEmailThemeClasses();
  const lightStyles = getEmailInlineStyles("light");

  return (
    <EmailThemeProvider preview={<Preview>Your preview text</Preview>}>
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
            className={`text-[24px] font-bold ${themeClasses.heading}`}
            style={{ color: lightStyles.text.color }}
          >
            Hello {userName}!
          </Heading>

          <Text
            className={`text-base ${themeClasses.text}`}
            style={{ color: lightStyles.text.color }}
          >
            Your email content here...
          </Text>

          <Link
            href={actionUrl}
            className={`block my-[32px] p-[12px_24px] bg-black text-white rounded-md ${themeClasses.button}`}
            style={{ backgroundColor: "#000", color: "#fff" }}
          >
            Take Action
          </Link>

          <Footer />
        </Container>
      </Body>
    </EmailThemeProvider>
  );
};

export default YourTemplate;
```

### Step 2: Add Type Definitions

**File**: `api/src/services/email-queue.ts`

```typescript
// Add to EmailTemplate union
export type EmailTemplate =
  | "welcome-newsletter"
  | "document-newsletter"
  | "your-template"; // Add here

// Add props interface
export type EmailTemplateProps = {
  "welcome-newsletter": {
    token?: string;
  };
  "document-newsletter": {
    document: DocumentData;
    recipientEmail: string;
    unsubscribeToken?: string;
  };
  "your-template": {
    userName: string;
    actionUrl: string;
  };
};
```

### Step 3: Add Render Case

**File**: `api/src/services/email-queue.ts`

```typescript
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
    case "your-template": {
      const YourTemplate = (await import("@brain/email/emails/your-template"))
        .default;
      return render(createElement(YourTemplate, props));
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
};
```

### Step 4: Create Helper Function (Optional)

```typescript
export const enqueueYourTemplate = async (
  env: WorkerEnv,
  userName: string,
  actionUrl: string,
  email: string,
  options?: EnqueueOptions
) => {
  return enqueueEmailJob(
    env,
    {
      template: "your-template",
      to: email,
      subject: `Action Required, ${userName}`,
      from: "Irere Emmanuel",
      fromEmail: "action",
      props: {
        userName,
        actionUrl,
      },
    },
    options
  );
};
```

### Step 5: Test Template

```bash
cd packages/email
bun dev
```

Visit `http://localhost:3003` to preview your template.

## Resend Integration

### API Key Setup

**Environment Variables**:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_DOMAIN=irere.dev
```

**Wrangler Configuration**:

```jsonc
{
  "vars": {
    "RESEND_DOMAIN": "irere.dev",
  },
}
```

Add `RESEND_API_KEY` to secrets:

```bash
wrangler secret put RESEND_API_KEY --env production
```

### Email Sender Configuration

The `from` address is constructed as:

```typescript
const fromAddress = fromEmail
  ? `${from} <${fromEmail}@${RESEND_DOMAIN}>`
  : `${from} <no-reply@${RESEND_DOMAIN}>`;

// Examples:
// "Irere Emmanuel <newsletter@irere.dev>"
// "Support Team <support@irere.dev>"
// "Updates <no-reply@irere.dev>"
```

### Resend Limits

**Free Plan**:

- 100 emails/day
- 3,000 emails/month

**Production Plan** (recommended):

- 50,000+ emails/month
- $20/month base + overages

**Rate Limits**:

- API: 10 requests/second
- Adjust batch size if hitting limits

### Error Handling

Common Resend errors and solutions:

**401 Unauthorized**:

- Check API key is correct
- Verify key has proper permissions

**403 Forbidden**:

- Domain not verified in Resend
- Sender email not authorized

**422 Validation Error**:

- Invalid email address
- Missing required fields
- Check props passed to template

**429 Rate Limit**:

- Reduce batch size
- Add delay between batches
- Upgrade Resend plan

## Best Practices

### 1. Batch Recipients

**Bad** (creates many jobs):

```typescript
for (const subscriber of subscribers) {
  await enqueueEmailJob(env, {
    /* ... */
  });
}
```

**Good** (single batch operation):

```typescript
await enqueueDocumentNewsletter(env, document, subscribers);
```

### 2. Validate Data Before Enqueueing

```typescript
// Validate email
if (!isValidEmail(recipient.email)) {
  console.error(`Invalid email: ${recipient.email}`);
  continue;
}

// Validate document
if (!document.title || !document.markdown) {
  throw new Error("Document must have title and content");
}
```

### 3. Use Appropriate Priority

```typescript
// High priority (9): Password resets, verification emails
await enqueueEmailJob(env, payload, { priority: 9 });

// Normal priority (5): Newsletters, updates
await enqueueEmailJob(env, payload, { priority: 5 });

// Low priority (1): Digest emails, marketing
await enqueueEmailJob(env, payload, { priority: 1 });
```

### 4. Set Reasonable Retry Limits

```typescript
// Critical emails: More retries
await enqueueEmailJob(env, payload, {
  maxAttempts: 5,
  backoffSettings: {
    strategy: "exponential",
    maxDelayMs: 3600000, // 1 hour max
  },
});

// Non-critical: Fewer retries
await enqueueEmailJob(env, payload, {
  maxAttempts: 3,
});
```

### 5. Monitor Queue Health

```typescript
// Regular stats checking
const stats = await getEmailQueueStats(env);

if (stats.waiting > 1000) {
  // Alert: Queue backing up
}

if (stats.failed > 50) {
  // Alert: High failure rate
}
```

### 6. Test Templates Before Deployment

```bash
cd packages/email
bun dev
```

- Preview all templates
- Test with various data
- Check mobile rendering
- Verify links work

## Troubleshooting

### Emails Not Sending

**Check**:

1. Is `processEmailJobs()` being called?
2. Are there jobs in the queue? (`getEmailQueueStats()`)
3. Check worker logs for errors
4. Verify Resend API key is set

### Template Rendering Errors

**Common Issues**:

- Missing required props
- Type mismatch in props
- Import path incorrect
- Component not exported as default

**Solution**:

```typescript
// Add error logging
try {
  const html = await renderEmailTemplate(template, props);
} catch (error) {
  console.error("Template render failed:", error);
  console.error("Template:", template);
  console.error("Props:", props);
  throw error;
}
```

### High Failure Rate

**Investigate**:

```typescript
const stats = await getEmailQueueStats(env);
console.log(`Failed: ${stats.failed}`);

// Check DLQ jobs manually
// (requires direct DO storage access)
```

**Common Causes**:

- Resend API down
- Invalid email addresses
- Rate limit exceeded
- Template error

### Unsubscribe Links Not Working

**Check**:

1. Is `unsubscribeToken` being passed?
2. Does unsubscribe endpoint exist?
3. Is token valid in database?

**Debug**:

```typescript
console.log("Unsubscribe URL:", `${baseUrl}/unsubscribe?token=${token}`);
```

## Next Steps

- [Queue System Documentation →](./QUEUE_SYSTEM.md)
- [Architecture Overview →](./ARCHITECTURE.md)
- [Contributing Guide →](./CONTRIBUTING.md)
