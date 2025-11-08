# System Architecture

This document describes the overall architecture of the irere-brain system, focusing on the queue and email subsystems.

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Components](#components)
- [Data Flow](#data-flow)
- [Design Decisions](#design-decisions)
- [Scalability](#scalability)

## Overview

irere-brain uses a **serverless-first architecture** built entirely on Cloudflare's edge platform. The system is designed for:

- **Global distribution**: Code runs on Cloudflare's edge network
- **Zero cold starts**: V8 isolates start in <1ms
- **Infinite scale**: Auto-scales with demand
- **Cost efficiency**: Pay-per-request pricing

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                    │
│  │   Workers    │◄────────┤  Web Client  │                    │
│  │   (Hono)     │         └──────────────┘                    │
│  └──────┬───────┘                                              │
│         │                                                       │
│         ├────► REST API (OpenAPI)                             │
│         ├────► tRPC API (Type-safe)                           │
│         └────► Auth (Better Auth)                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Job Queue System                             │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │          QueueClient (Coordination)                 │  │ │
│  │  │  • Job enqueue/claim/complete/fail                  │  │ │
│  │  │  • Shard selection & load balancing                │  │ │
│  │  │  • Batch operations                                 │  │ │
│  │  └────────┬────────┬────────┬────────┬────────────────┘  │ │
│  │           │        │        │        │                    │ │
│  │    ┌──────▼──┐ ┌──▼────┐ ┌─▼──────┐ ┌▼────────┐         │ │
│  │    │ Shard 0 │ │Shard 1│ │Shard 2 │ │ Shard 3 │         │ │
│  │    │   DO    │ │  DO   │ │   DO   │ │   DO    │         │ │
│  │    └─────────┘ └───────┘ └────────┘ └─────────┘         │ │
│  │         ▲          ▲         ▲          ▲                 │ │
│  │         │          │         │          │                 │ │
│  │         └──────────┴─────────┴──────────┘                 │ │
│  │                     │                                      │ │
│  │              ┌──────▼───────┐                             │ │
│  │              │  Shard Map   │                             │ │
│  │              │     (KV)     │                             │ │
│  │              └──────────────┘                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Email Service                                │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  • Template rendering (React Email)                 │  │ │
│  │  │  • Job processing (claim → render → send)          │  │ │
│  │  │  • Resend API integration                          │  │ │
│  │  │  • Retry handling                                   │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐                       │
│  │ PostgreSQL   │      │   KV Store   │                       │
│  │ (Hyperdrive) │      │ (Metadata)   │                       │
│  └──────────────┘      └──────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │  Resend API   │
                        │ (Email SMTP)  │
                        └───────────────┘
```

## Components

### 1. Worker (Entry Point)

**File**: `api/src/index.ts`

The main Cloudflare Worker that handles all incoming HTTP requests.

**Responsibilities**:

- Route requests to appropriate handlers
- Manage middleware (CORS, auth, etc.)
- Export Durable Object classes
- Initialize services

**Key Code**:

```typescript
export default {
  fetch: app.fetch, // Hono app
};

export { QueueDurableObject }; // Export DO for Cloudflare
```

### 2. Queue System

**Files**: `api/src/queue/`

A complete job queue implementation using Durable Objects for persistence.

#### 2.1 QueueClient (`client.ts`)

High-level API for queue operations.

**Responsibilities**:

- Enqueue jobs with options
- Claim jobs for processing
- Mark jobs complete/failed
- Manage retries and backoff
- Query queue statistics

#### 2.2 QueueDurableObject (`durable-object.ts`)

The core queue logic running in Durable Objects.

**Responsibilities**:

- Store job state in persistent storage
- Manage job lifecycle transitions
- Handle delayed jobs with alarms
- Implement atomic operations
- Track retry attempts

**State Machine**:

```
waiting ──claim──► active ──complete──► [deleted]
   ▲                  │
   │                  │fail
   │                  ▼
   └────────────── delayed
                      │
                      └──► dead (after max retries)
```

#### 2.3 Sharding (`shards.ts`)

Distributes jobs across multiple Durable Objects for horizontal scaling.

**Responsibilities**:

- Map queues to shard IDs
- Consistent hashing for shard selection
- Shard metadata management in KV
- Dynamic shard provisioning

### 3. Email Service

**Files**: `api/src/services/email-queue.ts`

Specialized service for sending emails using the queue system.

**Responsibilities**:

- Enqueue email jobs with templates
- Render React Email templates to HTML
- Send emails via Resend API
- Handle email-specific retries
- Batch email operations

#### 3.1 Email Templates

**Files**: `packages/email/emails/`

React components that render to HTML emails.

**Available Templates**:

1. `welcome-newsletter.tsx` - Welcome email with verification
2. `document-newsletter.tsx` - Newsletter from document content

### 4. Bindings (`queue/bindings.ts`)

Helper functions to create queue clients with proper bindings.

**Responsibilities**:

- Initialize KV namespace
- Initialize Durable Object namespace
- Create configured queue clients
- Type-safe environment setup

## Data Flow

### Email Sending Flow

```
1. User Action (e.g., publish newsletter)
   │
   ▼
2. Call enqueueDocumentNewsletter()
   │
   ▼
3. QueueClient.enqueue()
   │
   ├─► Select shard (hash-based)
   │
   └─► DurableObject.enqueue()
       │
       ├─► Store job envelope
       ├─► Add to "waiting" index
       └─► Return job ID

4. Cron/Manual Trigger: processEmailJobs()
   │
   ▼
5. QueueClient.claim(batchSize)
   │
   ├─► Query all shards
   │
   └─► DurableObject.claim()
       │
       ├─► Get jobs from "waiting"
       ├─► Move to "active" with lease
       └─► Return job envelopes

6. For each job:
   │
   ├─► Render React Email template
   │
   ├─► Call Resend API
   │
   └─► Success?
       ├─► Yes: QueueClient.complete()
       │         └─► Delete job
       │
       └─► No: QueueClient.fail()
                 │
                 ├─► attempts < maxAttempts?
                 │   ├─► Yes: Move to "delayed"
                 │   │         with backoff delay
                 │   └─► No: Move to "dead"
                 │
                 └─► Return

7. Background: DurableObject.alarm()
   │
   └─► processDelayedJobs()
       │
       └─► Move delayed jobs → waiting
           when delay expires
```

### Retry Flow

```
Job fails
   │
   ▼
QueueClient.fail(jobId, leaseToken, reason)
   │
   ▼
DurableObject receives fail request
   │
   ├─► Validate lease token
   │
   ├─► Check attempts vs maxAttempts
   │
   └─► attempts < maxAttempts?
       │
       ├─── Yes:
       │    │
       │    ├─► Calculate backoff delay
       │    │   (exponential/linear/fixed)
       │    │
       │    ├─► delay > 0?
       │    │   ├─► Yes: Move to "delayed"
       │    │   │         Set delayUntil timestamp
       │    │   │         Schedule alarm
       │    │   └─► No: Move back to "waiting"
       │    │
       │    └─► Update job.attempts++
       │
       └─── No:
            │
            └─► Move to "dead" (DLQ)
                Store fail reason
```

## Design Decisions

### Why Durable Objects for Queue?

**Alternatives Considered**:

1. Cloudflare Queues - Limited to 100 producers, no priority/delay
2. External queue (SQS, RabbitMQ) - Adds latency, cost, complexity
3. Database as queue - Poor performance, polling overhead

**Chosen Solution**: Durable Objects

**Reasons**:

- ✅ Strong consistency guarantees
- ✅ Sub-millisecond latency (co-located with worker)
- ✅ Persistent storage included
- ✅ Automatic failover and recovery
- ✅ No polling needed (alarms for delays)
- ✅ Infinite horizontal scaling via sharding
- ✅ Atomic operations out of the box

### Why Sharding?

**Problem**: Single Durable Object has limits:

- Storage: ~50 operations/second per object
- CPU: Limited compute per object

**Solution**: Distribute jobs across multiple DOs (shards)

**Benefits**:

- Linear scaling with shard count
- Fault isolation (one shard failure doesn't affect others)
- Load balancing across shards
- Can process N \* 50 ops/second (N = shard count)

**Tradeoff**: Slightly more complex coordination logic

### Why React Email?

**Alternatives Considered**:

1. Raw HTML strings - Hard to maintain
2. Template engines (Handlebars, EJS) - Not type-safe
3. MJML - Additional build step, learning curve

**Chosen Solution**: React Email

**Reasons**:

- ✅ Type-safe templates with TypeScript
- ✅ Component reusability
- ✅ Familiar React syntax
- ✅ Preview server for development
- ✅ Automatic inline CSS
- ✅ Cross-client compatibility

### Why Custom Queue vs Cloudflare Queues?

**Cloudflare Queues Limitations**:

- Maximum 100 producers
- No priority queues
- No delayed jobs
- Limited batch size (100 messages)
- No dead letter queue
- Limited retry configuration

**Our Requirements**:

- Unlimited producers (any worker can enqueue)
- Priority-based job ordering
- Delayed/scheduled jobs
- Custom retry with backoff strategies
- Dead letter queue for failed jobs
- Fine-grained control over all aspects

**Result**: Custom implementation gives us full control

## Scalability

### Current Limits

**Single Shard**:

- ~50 enqueue operations/second
- ~50 claim operations/second
- Unlimited storage (practical limit: ~50GB)

**With 4 Shards (default)**:

- ~200 enqueue operations/second
- ~200 claim operations/second
- Distributed storage

### Scaling Strategy

**Vertical Scaling** (increase per-shard capacity):

- Limited by Durable Object constraints
- Not the primary scaling method

**Horizontal Scaling** (add more shards):

1. Update queue configuration:

   ```typescript
   {
     queues: {
       email: {
         durableObjectNamespace: "EMAIL_QUEUE_SHARD",
         shardCount: 8, // Increased from 4
       },
     },
   }
   ```

2. New shard map automatically created in KV
3. Jobs distributed across more shards
4. Linear throughput increase

**Auto-Scaling Considerations**:

- Monitor queue stats (waiting, active counts)
- Alert when queues are backing up
- Manually increase shard count when needed
- Future: Dynamic shard provisioning based on load

### Performance Metrics

**Expected Throughput** (4 shards):

- Enqueue: 200 jobs/second
- Claim: 200 jobs/second
- Email rendering: ~100ms per email
- Resend API: ~200ms per email
- **Total pipeline**: ~50 emails/second

**Bottlenecks**:

1. Resend API rate limits (check plan limits)
2. DO operation limits (solved by sharding)
3. Email rendering (parallel processing helps)

## Next Steps

- [Learn about the Queue System →](./QUEUE_SYSTEM.md)
- [Learn about Email Service →](./EMAIL_SERVICE.md)
- [Learn about Collections Feature →](./COLLECTIONS_SUMMARY.md)
- [Contributing Guide →](./CONTRIBUTING.md)
