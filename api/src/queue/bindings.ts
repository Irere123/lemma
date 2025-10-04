import type { QueueClientBindings, QueueClientOptions } from "./types.ts";
import { createQueueClient } from "./client.ts";

export type WorkerEnv = {
  QUEUE_SHARDS_KV: KVNamespace;
  EMAIL_QUEUE_SHARD: DurableObjectNamespace;
};

export const createQueueBindings = (env: WorkerEnv): QueueClientBindings => {
  return {
    kvNamespace: env.QUEUE_SHARDS_KV as any,
    durableObjects: {
      EMAIL_QUEUE_SHARD: env.EMAIL_QUEUE_SHARD as any,
    },
  };
};

export const createEmailQueueClient = (env: WorkerEnv) => {
  const bindings = createQueueBindings(env);

  const options: QueueClientOptions = {
    defaultDurableObjectNamespace: "EMAIL_QUEUE_SHARD",
    defaultShardCount: 4,
    queues: {
      email: {
        durableObjectNamespace: "EMAIL_QUEUE_SHARD",
        shardCount: 4,
      },
    },
  };

  return createQueueClient(bindings, options);
};
