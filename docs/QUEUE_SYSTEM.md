# Queue System Documentation

Complete guide to the job queue system built on Cloudflare Durable Objects.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Components](#components)
- [Job Lifecycle](#job-lifecycle)
- [Sharding](#sharding)
- [Storage Layout](#storage-layout)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

The queue system provides reliable, distributed job processing with:

- **Persistent storage**: Jobs survive worker restarts
- **Atomic operations**: No race conditions or duplicate processing
- **Automatic retries**: Configurable backoff strategies
- **Priority queues**: Process important jobs first
- **Delayed execution**: Schedule jobs for future processing
- **Dead letter queue**: Handle jobs that fail repeatedly
- **Horizontal scaling**: Add shards to increase capacity

## Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────┐
│           QueueClient (Coordinator)             │
│  • API for enqueue/claim/complete/fail          │
│  • Shard selection logic                        │
│  • Multi-shard operations                       │
└─────────┬───────────────────────────────────────┘
          │
          ├───► Shard Selection (Hash-based)
          │
    ┌─────▼────┬─────────┬──────────┬──────────┐
    │          │         │          │          │
┌───▼───┐  ┌───▼───┐ ┌───▼───┐  ┌───▼───┐    │
│Shard 0│  │Shard 1│ │Shard 2│  │Shard 3│    │
│  (DO) │  │  (DO) │ │  (DO) │  │  (DO) │    │
└───┬───┘  └───┬───┘ └───┬───┘  └───┬───┘    │
    │          │         │          │          │
    └──────────┴─────────┴──────────┴──────────┘
                         │
                    ┌────▼─────┐
                    │ KV Store │
                    │(Shard Map)│
                    └──────────┘
```

### Request Flow

```
1. Worker receives job request
   │
   ▼
2. QueueClient.enqueue(queueName, jobData, options)
   │
   ├─► Compute shard: hash(jobId || shardKey) % shardCount
   │
   └─► DurableObject[shardIndex].enqueue()
       │
       └─► Store in DO storage:
           ├─► job:${jobId} → JobEnvelope
           ├─► waiting:${priority}:${timestamp}:${jobId} → ""
           └─► meta:max-attempts:${jobId} → maxAttempts
```

## Components

### 1. QueueClient (`src/queue/client.ts`)

The main interface for interacting with the queue.

#### Methods

**`enqueue<Data>(queueName, jobData, options)`**

Add a job to the queue.

```typescript
const result = await client.enqueue(
  "email",
  {
    to: "user@example.com",
    subject: "Hello",
  },
  {
    priority: 5, // 0-99, higher = processed first
    delayMs: 5000, // Delay 5 seconds
    maxAttempts: 3, // Retry up to 3 times
    shardKey: "user123", // Optional: control shard placement
    backoffSettings: {
      strategy: "exponential",
      delayMs: 1000,
      maxDelayMs: 60000,
      factor: 2,
    },
  }
);

// Returns: { job: JobEnvelope, shardId: string }
```

**`claim<Data>(queueName, batchSize)`**

Claim jobs for processing (consumer side).

```typescript
const jobs = await client.claim<EmailJob>("email", 10);

for (const job of jobs) {
  console.log(job.id, job.data, job.leaseToken);
  // Process the job...
}
```

**`complete(queueName, jobId, leaseToken)`**

Mark a job as successfully completed.

```typescript
await client.complete("email", job.id, job.leaseToken);
```

**`fail(queueName, jobId, leaseToken, reason)`**

Mark a job as failed (triggers retry or moves to DLQ).

```typescript
await client.fail("email", job.id, job.leaseToken, "SMTP error");
```

**`processDelayedJobs(queueName)`**

Move delayed jobs to waiting state (called by cron or manually).

```typescript
const moved = await client.processDelayedJobs("email");
console.log(`Moved ${moved} jobs to waiting`);
```

**`getStats(queueName)`**

Get queue statistics.

```typescript
const stats = await client.getStats("email");
// {
//   waiting: 42,  // Ready to process
//   active: 5,    // Currently processing
//   delayed: 10,  // Scheduled/retry
//   failed: 2     // In dead letter queue
// }
```

### 2. QueueDurableObject (`src/queue/durable-object.ts`)

The core queue implementation running in a Durable Object.

#### Internal Methods

- `enqueue()` - Store job and add to waiting/delayed index
- `claim()` - Atomically move jobs from waiting → active
- `complete()` - Delete completed job
- `fail()` - Retry or move to DLQ
- `processDelayed()` - Promote delayed jobs to waiting
- `getStats()` - Count jobs in each state
- `alarm()` - Automatically process delayed jobs

#### Storage Operations

All operations use transactions for atomicity:

```typescript
await this.state.storage.transaction(async (txn) => {
  // Read
  const job = await txn.get<JobEnvelope>(jobKey);

  // Write
  await txn.put(jobKey, updatedJob);

  // Delete
  await txn.delete(jobKey);

  // All or nothing - automatic rollback on error
});
```

### 3. Sharding System (`src/queue/shards.ts`)

Distributes jobs across multiple Durable Objects.

#### Shard Map

Stored in KV: `queue:shard-map:${queueName}`

```json
{
  "queueName": "email",
  "shardIds": [
    "durable-object-id-0",
    "durable-object-id-1",
    "durable-object-id-2",
    "durable-object-id-3"
  ],
  "updatedAt": 1234567890
}
```

#### Shard Selection

Uses consistent hashing for deterministic shard assignment:

```typescript
const hash = hashStringToPositiveNumber(shardKey || jobId);
const shardIndex = hash % shardIds.length;
const shardId = shardIds[shardIndex];
```

**Benefits**:

- Same job always goes to same shard (idempotency)
- Evenly distributed load
- Predictable shard lookup

## Job Lifecycle

### State Transitions

```
┌──────────┐
│ ENQUEUED │
└────┬─────┘
     │
     ├─ delayMs > 0 ─────┐
     │                   │
     ▼                   ▼
┌─────────┐         ┌─────────┐
│ WAITING │         │ DELAYED │
└────┬────┘         └────┬────┘
     │                   │
     │  claim()          │ alarm()
     │                   │
     ▼                   ▼
┌────────┐          ┌─────────┐
│ ACTIVE │──retry───►│ DELAYED │
└───┬─┬──┘          └─────────┘
    │ │
    │ └── fail (max attempts) ──► ┌──────┐
    │                              │ DEAD │
    │                              └──────┘
    └─── complete() ──► [deleted]
```

### State Descriptions

**WAITING**

- Job is ready to be claimed
- Sorted by priority, then timestamp
- Remains until claimed or deleted

**DELAYED**

- Job is scheduled for future execution
- Has `delayUntil` timestamp
- Durable Object alarm promotes to WAITING when time arrives

**ACTIVE**

- Job is currently being processed
- Has lease token to prevent duplicate processing
- Remains until completed or failed

**DEAD (DLQ)**

- Job failed after max retry attempts
- Stored with failure reason
- Requires manual intervention or cleanup

### Job Envelope Structure

```typescript
type JobEnvelope<Data = unknown> = {
  id: string; // Unique job ID (UUID)
  data: Data; // Job payload
  status: JobStatus; // Current state
  attempts: number; // Retry count
  maxAttempts: number; // Max allowed retries
  priority: number; // 0-99, higher first
  delayUntil: number | null; // Timestamp for delayed jobs
  createdAt: number; // Creation timestamp
  updatedAt: number; // Last update timestamp
  leaseToken: string | null; // For active jobs only
  failReason: string | null; // Last failure reason
  backoffSettings: {
    // Retry configuration
    strategy: "none" | "fixed" | "linear" | "exponential";
    delayMs?: number;
    maxDelayMs?: number;
    factor?: number;
    jitterRatio?: number;
  };
};
```

## Sharding

### Why Shard?

**Without Sharding** (single Durable Object):

- Limited to ~50 operations/second
- Single point of failure
- Storage limited to one object

**With Sharding** (multiple Durable Objects):

- N × 50 operations/second (N = shard count)
- Fault isolation
- Distributed storage

### Shard Count Selection

**Factors to Consider**:

1. **Expected Load**
   - < 50 jobs/sec: 1-2 shards
   - 50-200 jobs/sec: 4 shards (default)
   - 200-500 jobs/sec: 8-10 shards
   - > 500 jobs/sec: 10+ shards

2. **Queue Criticality**
   - Critical: More shards for redundancy
   - Non-critical: Fewer shards to save cost

3. **Job Distribution**
   - Uniform: Any shard count works
   - Skewed: More shards help balance

### Configuration Example

```typescript
const client = createQueueClient(bindings, {
  defaultShardCount: 4,
  queues: {
    email: {
      durableObjectNamespace: "EMAIL_QUEUE_SHARD",
      shardCount: 8, // Override for high-volume queue
    },
    low_priority: {
      durableObjectNamespace: "EMAIL_QUEUE_SHARD",
      shardCount: 2, // Lower count for low-volume queue
    },
  },
});
```

### Shard Operations

**Listing All Shards**:

```typescript
const shards = await listShards(queueName, namespace, bindings, count);
// Returns array of { shardId, stub }
```

**Selecting a Shard**:

```typescript
const { shardSelection } = await selectShard(
  queueName,
  namespace,
  bindings,
  count,
  shardKey
);
// Returns { shardId, stub }
```

## Storage Layout

Each Durable Object uses key-value storage with specific key patterns:

### Key Patterns

```
job:${jobId}
  Value: JobEnvelope (serialized)
  Purpose: Store complete job data

waiting:${priority}:${createdAt}:${jobId}
  Value: "" (presence marker)
  Purpose: Index for claiming jobs (sorted)

delayed:${delayUntil}:${jobId}
  Value: "" (presence marker)
  Purpose: Index for delayed jobs (sorted by time)

active:${jobId}
  Value: leaseToken (string)
  Purpose: Track active jobs and their lease

dead:${jobId}
  Value: failReason (string)
  Purpose: Dead letter queue index

meta:max-attempts:${jobId}
  Value: number
  Purpose: Quick lookup for retry logic
```

### Example Storage State

```
// Job envelope
job:abc123 → {
  id: "abc123",
  data: { to: "user@example.com" },
  status: "waiting",
  priority: 5,
  ...
}

// Waiting index (sorted by priority + timestamp)
waiting:00005:1234567890:abc123 → ""

// Priority encoding: 00005 (padded, lower first)
// Timestamp: 1234567890 (epoch ms)
// JobId: abc123 (tie-breaker)
```

### Storage Queries

**Claim Jobs** (sorted list query):

```typescript
const entries = await storage.list({
  prefix: "waiting:",
  limit: batchSize,
});
// Returns sorted by key → highest priority first
```

**Process Delayed** (range query):

```typescript
const now = Date.now();
const entries = await storage.list({
  prefix: "delayed:",
  limit: 100,
});

for (const [key, value] of entries) {
  const delayUntil = extractTimestampFromKey(key);
  if (delayUntil <= now) {
    // Promote to waiting
  }
}
```

## API Reference

### Enqueue Options

```typescript
type EnqueueOptions = {
  delayMs?: number; // Delay before processing
  priority?: number; // 0-99, higher = first
  maxAttempts?: number; // Max retry attempts
  shardKey?: string; // Control shard placement
  jobId?: string; // Custom job ID (must be unique)
  backoffSettings?: {
    strategy: BackoffStrategy;
    delayMs?: number; // Base delay for retries
    maxDelayMs?: number; // Cap on retry delay
    factor?: number; // Exponential factor
    jitterRatio?: number; // Add randomness (0-1)
  };
};
```

### Backoff Strategies

**None** - No delay between retries:

```typescript
{
  strategy: "none";
}
```

**Fixed** - Constant delay:

```typescript
{
  strategy: "fixed",
  delayMs: 5000,  // 5 seconds every time
}
```

**Linear** - Increasing delay:

```typescript
{
  strategy: "linear",
  delayMs: 1000,     // Base: 1 second
  maxDelayMs: 60000, // Cap: 1 minute
}
// Retry delays: 1s, 2s, 3s, 4s, ...
```

**Exponential** - Exponentially increasing (recommended):

```typescript
{
  strategy: "exponential",
  delayMs: 1000,     // Base: 1 second
  maxDelayMs: 60000, // Cap: 1 minute
  factor: 2,         // Double each time
  jitterRatio: 0.1,  // ±10% randomness
}
// Retry delays: ~1s, ~2s, ~4s, ~8s, ~16s, ~32s, 60s, 60s, ...
```

## Configuration

### Wrangler Setup

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
      "id": "your-kv-namespace-id",
    },
  ],
}
```

### TypeScript Bindings

```typescript
// src/queue/bindings.ts
export type WorkerEnv = {
  QUEUE_SHARDS_KV: KVNamespace;
  EMAIL_QUEUE_SHARD: DurableObjectNamespace;
};

export const createEmailQueueClient = (env: WorkerEnv) => {
  return createQueueClient(createQueueBindings(env), {
    defaultDurableObjectNamespace: "EMAIL_QUEUE_SHARD",
    defaultShardCount: 4,
    queues: {
      email: {
        durableObjectNamespace: "EMAIL_QUEUE_SHARD",
        shardCount: 4,
      },
    },
  });
};
```

## Monitoring

### Queue Statistics

```typescript
const stats = await client.getStats("email");

console.log(`
  Waiting: ${stats.waiting}
  Active: ${stats.active}
  Delayed: ${stats.delayed}
  Failed: ${stats.failed}
`);
```

### Key Metrics to Track

1. **Queue Depth** (`waiting + delayed`)
   - Alert if consistently growing
   - Indicates consumer can't keep up

2. **Active Jobs** (`active`)
   - Should be proportional to consumer concurrency
   - High count may indicate stuck jobs

3. **Failed Jobs** (`failed`)
   - Check DLQ regularly
   - Investigate patterns in failures

4. **Processing Latency**
   - Time from enqueue → claim → complete
   - Track p50, p95, p99

### Example Monitoring Setup

```typescript
// Cron job: every 5 minutes
export default {
  async scheduled(event, env, ctx) {
    const stats = await getEmailQueueStats(env);

    // Alert if queue is backing up
    if (stats.waiting > 1000) {
      await alertOps("Queue depth high", stats);
    }

    // Alert on DLQ growth
    if (stats.failed > 100) {
      await alertOps("DLQ threshold exceeded", stats);
    }

    // Log metrics
    console.log(JSON.stringify({ timestamp: Date.now(), ...stats }));
  },
};
```

## Troubleshooting

### Jobs Not Processing

**Symptoms**: `waiting` count grows but jobs don't complete

**Possible Causes**:

1. Consumer not running
2. Jobs failing immediately (check `failed` count)
3. Shard limit reached

**Solutions**:

- Ensure `processEmailJobs()` is called regularly
- Check consumer logs for errors
- Increase shard count if limit reached

### Duplicate Job Processing

**Symptoms**: Same job processed multiple times

**Possible Causes**:

1. Consumer not calling `complete()` with correct lease token
2. Lease token not being saved
3. Transaction not completing

**Solutions**:

- Always save `leaseToken` from claimed job
- Use the same token when calling `complete()`
- Ensure no errors between claim and complete

### Jobs Stuck in Active

**Symptoms**: `active` count stays high

**Possible Causes**:

1. Consumer crashes before completing
2. Long-running jobs without completion
3. Forgotten to call complete/fail

**Solutions**:

- Implement consumer timeout logic
- Always call `complete()` or `fail()`
- Add try/catch around job processing

### High Failure Rate

**Symptoms**: Most jobs end up in DLQ

**Possible Causes**:

1. External API failures (e.g., Resend down)
2. Invalid job data
3. maxAttempts too low

**Solutions**:

- Check external service status
- Validate job data before enqueueing
- Increase maxAttempts or adjust backoff
- Implement circuit breaker pattern

## Next Steps

- [Email Service Documentation →](./EMAIL_SERVICE.md)
- [Architecture Overview →](./ARCHITECTURE.md)
- [Contributing Guide →](./CONTRIBUTING.md)
