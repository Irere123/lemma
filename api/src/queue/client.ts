import { DEFAULT_SHARD_COUNT } from "./constants.ts";
import { ensureShardMap, listShards, selectShard } from "./shards.ts";
import type {
  ClaimOptions,
  ClaimResponse,
  CompleteResponse,
  DurableObjectFetchResponse,
  EnqueueOptions,
  EnqueueResponse,
  FailResponse,
  JobEnvelope,
  ProcessDelayedResponse,
  QueueClientBindings,
  QueueClientOptions,
  QueueDefinition,
  QueueStats,
} from "./types.ts";
import { generateJobId } from "./utils/id.ts";

const DISPATCH_URL = "https://queue.local/internal";

type StubResponse = Awaited<ReturnType<DurableObjectStub["fetch"]>>;

const assertResponseOk = async <Result>(response: StubResponse) => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Durable Object request failed: ${message || response.statusText}`
    );
  }

  const parsed = (await response.json()) as DurableObjectFetchResponse<Result>;

  if (!parsed.ok) {
    throw new Error(parsed.error ?? "Durable Object returned an unknown error");
  }

  return parsed.result as Result;
};

const ensureBatchSize = (batchSize?: number) => {
  if (
    typeof batchSize !== "number" ||
    Number.isNaN(batchSize) ||
    batchSize <= 0
  ) {
    return 1;
  }

  return Math.floor(batchSize);
};

const resolveShardKey = (jobId: string, shardKey?: string) => {
  if (shardKey) {
    return shardKey;
  }

  return jobId;
};

const dispatchToShard = async <Result>(
  stub: DurableObjectStub,
  op: string,
  payload?: unknown
) => {
  const response = await stub.fetch(DISPATCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ op, payload }),
  });

  return assertResponseOk<Result>(response);
};

export class QueueClient {
  readonly #bindings: QueueClientBindings;
  readonly #queues: Record<string, QueueDefinition>;
  readonly #defaultShardCount: number;
  readonly #defaultNamespace: string | null;

  constructor(bindings: QueueClientBindings, options: QueueClientOptions = {}) {
    this.#bindings = bindings;
    this.#queues = options.queues ?? {};
    this.#defaultNamespace = options.defaultDurableObjectNamespace ?? null;
    this.#defaultShardCount = options.defaultShardCount ?? DEFAULT_SHARD_COUNT;
  }

  registerQueue(queueName: string, definition: QueueDefinition) {
    this.#queues[queueName] = definition;
  }

  async enqueue<Data>(
    queueName: string,
    jobData: Data,
    options?: EnqueueOptions
  ) {
    const { namespace, shardCount } = this.#getQueueConfig(queueName);
    const jobId = options?.jobId ?? generateJobId();
    const shardKey = resolveShardKey(jobId, options?.shardKey);

    const { shardSelection } = await selectShard(
      queueName,
      namespace,
      this.#bindings,
      shardCount,
      shardKey
    );

    const payload = {
      jobData,
      options: {
        ...options,
        jobId,
      },
    } satisfies { jobData: Data; options: EnqueueOptions };

    const result = await dispatchToShard<EnqueueResponse>(
      shardSelection.stub,
      "enqueue",
      payload
    );

    return result;
  }

  async claim<Data>(queueName: string, batchSize?: number) {
    const { namespace, shardCount } = this.#getQueueConfig(queueName);
    const shards = await listShards(
      queueName,
      namespace,
      this.#bindings,
      shardCount
    );
    const claimed: JobEnvelope<Data>[] = [];
    const desired = ensureBatchSize(batchSize);

    for (const shard of shards) {
      const remaining = desired - claimed.length;

      if (remaining <= 0) {
        break;
      }

      const result = await dispatchToShard<ClaimResponse<Data>>(
        shard.stub,
        "claim",
        {
          batchSize: remaining,
        } satisfies ClaimOptions
      );

      if (result.jobs?.length) {
        claimed.push(...result.jobs);
      }
    }

    return claimed;
  }

  async complete(queueName: string, jobId: string, leaseToken: string) {
    const { namespace, shardCount } = this.#getQueueConfig(queueName);
    const shardKey = resolveShardKey(jobId, jobId);
    const { shardSelection } = await selectShard(
      queueName,
      namespace,
      this.#bindings,
      shardCount,
      shardKey
    );

    return dispatchToShard<CompleteResponse>(shardSelection.stub, "complete", {
      jobId,
      leaseToken,
    });
  }

  async fail(
    queueName: string,
    jobId: string,
    leaseToken: string,
    reason: string
  ) {
    const { namespace, shardCount } = this.#getQueueConfig(queueName);
    const shardKey = resolveShardKey(jobId, jobId);
    const { shardSelection } = await selectShard(
      queueName,
      namespace,
      this.#bindings,
      shardCount,
      shardKey
    );

    return dispatchToShard<FailResponse>(shardSelection.stub, "fail", {
      jobId,
      leaseToken,
      reason,
    });
  }

  async processDelayedJobs(queueName: string) {
    const { namespace, shardCount } = this.#getQueueConfig(queueName);
    const shards = await listShards(
      queueName,
      namespace,
      this.#bindings,
      shardCount
    );
    let moved = 0;

    for (const shard of shards) {
      const result = await dispatchToShard<ProcessDelayedResponse>(
        shard.stub,
        "processDelayed"
      );
      moved += result.moved;
    }

    return moved;
  }

  async getStats(queueName: string) {
    const { namespace, shardCount } = this.#getQueueConfig(queueName);
    const shards = await listShards(
      queueName,
      namespace,
      this.#bindings,
      shardCount
    );
    const totals: QueueStats = {
      waiting: 0,
      active: 0,
      failed: 0,
      delayed: 0,
    };

    for (const shard of shards) {
      const stats = await dispatchToShard<QueueStats>(shard.stub, "getStats");
      totals.waiting += stats.waiting;
      totals.active += stats.active;
      totals.failed += stats.failed;
      totals.delayed += stats.delayed;
    }

    return totals;
  }

  async ensureShardConsistency(queueName: string) {
    const { namespace, shardCount } = this.#getQueueConfig(queueName);
    await ensureShardMap(queueName, namespace, this.#bindings, shardCount);
  }

  #getQueueConfig(queueName: string) {
    const definition = this.#queues[queueName];

    const namespace =
      definition?.durableObjectNamespace ?? this.#defaultNamespace;

    if (!namespace) {
      throw new Error(
        `Queue ${queueName} does not have an associated durable object namespace`
      );
    }

    const shardCount = definition?.shardCount ?? this.#defaultShardCount;

    if (!Number.isInteger(shardCount) || shardCount <= 0) {
      throw new Error("Shard count must be a positive integer");
    }

    return {
      namespace,
      shardCount,
    } satisfies { namespace: string; shardCount: number };
  }
}

export const createQueueClient = (
  bindings: QueueClientBindings,
  options?: QueueClientOptions
) => {
  return new QueueClient(bindings, options);
};

export const createQueueModule = (
  bindings: QueueClientBindings,
  options?: QueueClientOptions
) => {
  const client = new QueueClient(bindings, options);

  return {
    client,
    enqueue: client.enqueue.bind(client),
    claim: client.claim.bind(client),
    complete: client.complete.bind(client),
    fail: client.fail.bind(client),
    processDelayedJobs: client.processDelayedJobs.bind(client),
    getStats: client.getStats.bind(client),
    ensureShardConsistency: client.ensureShardConsistency.bind(client),
  };
};
