import type { QueueClientBindings, QueueClientOptions } from "./types.ts";
import { createQueueClient } from "./client.ts";

export const createQueueBindings = (env: Env): QueueClientBindings => {
  return {
    kvNamespace: env.QUEUE_SHARDS_KV,
    durableObjects: {
      EMAIL_QUEUE_SHARD: env.EMAIL_QUEUE_SHARD,
    },
  };
};

export const createEmailQueueClient = (env: Env) => {
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
