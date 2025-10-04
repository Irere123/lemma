# Queue System for Cloudflare Workers

A fully-featured job queue system compatible with Cloudflare Workers, Durable Objects, and KV storage.

## Features

- **Job Lifecycle Management**: Enqueue, claim, complete, and fail jobs
- **Priority & Delay**: Support for job priority and delayed execution
- **Automatic Retries**: Configurable retry strategies with exponential/linear backoff
- **Dead Letter Queue**: Failed jobs after max attempts are moved to DLQ
- **Horizontal Scaling**: Shard-based architecture for scaling across multiple Durable Objects
- **Type-Safe**: Full TypeScript support

## Setup

### 1. Wrangler Configuration

The Durable Object and KV namespace are already configured in `wrangler.jsonc`:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "EMAIL_QUEUE_SHARD",
        "class_name": "QueueDurableObject",
        "script_name": "brainos-api",
      },
    ],
  },
  "kv_namespaces": [
    {
      "binding": "QUEUE_SHARDS_KV",
      "id": "your-kv-id",
    },
  ],
}
```

### 2. Usage Example

#### Enqueue a Welcome Newsletter

```typescript
import { enqueueWelcomeNewsletter } from "./services/email-queue";

// Send welcome email with verification token
const result = await enqueueWelcomeNewsletter(
  env,
  "user@example.com",
  "verification-token-123",
  {
    priority: 5,
    delayMs: 5000, // Delay 5 seconds
    maxAttempts: 3,
  }
);
```

#### Enqueue a Document Newsletter

```typescript
import { enqueueDocumentNewsletter } from "./services/email-queue";

// Send document newsletter to subscribers
const document = {
  id: "doc-123",
  title: "Building Better Software",
  subtitle: "A guide to clean architecture",
  type: "NEWSLETTER",
  markdown: "# Hello World\n\nThis is my newsletter content...",
  bannerImage: "https://example.com/banner.jpg",
  publishedDate: new Date(),
};

const recipients = [
  { email: "subscriber1@example.com", unsubscribeToken: "token-1" },
  { email: "subscriber2@example.com", unsubscribeToken: "token-2" },
];

const results = await enqueueDocumentNewsletter(env, document, recipients, {
  priority: 5,
  maxAttempts: 3,
});
```

#### Process Email Jobs

```typescript
import { processEmailJobs } from "./services/email-queue";

// Process up to 10 jobs
const results = await processEmailJobs(env, 10);

console.log(results);
// [
//   { jobId: "uuid-1", status: "completed" },
//   { jobId: "uuid-2", status: "failed", reason: "Network error" }
// ]
```

#### Get Queue Statistics

```typescript
import { getEmailQueueStats } from "./services/email-queue";

const stats = await getEmailQueueStats(env);
console.log(stats);
// {
//   waiting: 42,
//   active: 5,
//   delayed: 10,
//   failed: 2
// }
```

## Architecture

### Components

1. **QueueDurableObject**: Core queue logic with persistent storage
2. **Sharding**: Distribute jobs across multiple Durable Objects for scale
3. **QueueClient**: High-level API for queue operations
4. **Email Queue Service**: Specialized service for email job processing

### Job States

- `waiting`: Ready to be claimed
- `active`: Currently being processed
- `delayed`: Scheduled for future processing
- `dead`: Failed after max retry attempts

### Backoff Strategies

- `none`: No retry delay
- `fixed`: Fixed delay between retries
- `linear`: Linearly increasing delay
- `exponential`: Exponentially increasing delay (recommended)

## API Reference

### Core Functions

- `enqueue(queueName, jobData, options)`: Add a job to the queue
- `claim(queueName, batchSize)`: Claim jobs for processing
- `complete(queueName, jobId, leaseToken)`: Mark job as completed
- `fail(queueName, jobId, leaseToken, reason)`: Mark job as failed (triggers retry)
- `processDelayedJobs(queueName)`: Move delayed jobs to waiting state
- `getStats(queueName)`: Get queue statistics

### Email Queue Functions

- `enqueueEmailJob<T>(env, payload, options)`: Enqueue an email job with a specific template
- `enqueueWelcomeNewsletter(env, email, token, options)`: Send welcome newsletter
- `enqueueDocumentNewsletter(env, document, recipients, options)`: Send document newsletter to multiple recipients
- `processEmailJobs(env, batchSize)`: Process email jobs and render templates
- `processDelayedEmailJobs(env)`: Process delayed email jobs
- `getEmailQueueStats(env)`: Get email queue statistics

### Available Templates

- **welcome-newsletter**: Welcome email with optional verification token
  - Props: `{ token?: string }`
- **document-newsletter**: Newsletter email with document content
  - Props: `{ document: DocumentData, recipientEmail: string, unsubscribeToken?: string }`
