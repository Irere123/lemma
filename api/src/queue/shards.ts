import type {
  QueueClientBindings,
  QueueShardMap,
  QueueShardSelection,
} from "./types.ts";
import { hashStringToPositiveNumber } from "./utils/hash.ts";
import { now } from "./utils/time.ts";

const SHARD_MAP_PREFIX = "queue:shard-map:";

const createShardKVKey = (queueName: string) => {
  return `${SHARD_MAP_PREFIX}${queueName}`;
};

const generateShardIds = (queueName: string, shardCount: number) => {
  if (shardCount <= 0) {
    throw new Error("Shard count must be positive");
  }

  const identifiers: string[] = [];

  for (let index = 0; index < shardCount; index += 1) {
    identifiers.push(`${queueName}:shard:${index}`);
  }

  return identifiers;
};

export const loadShardMap = async (
  queueName: string,
  bindings: QueueClientBindings
) => {
  const key = createShardKVKey(queueName);
  const value = await bindings.kvNamespace.get(key, { type: "json" });

  if (!value) {
    return null;
  }

  return value as QueueShardMap;
};

export const persistShardMap = async (
  queueName: string,
  shardIds: readonly string[],
  bindings: QueueClientBindings
) => {
  const key = createShardKVKey(queueName);
  const shardMap: QueueShardMap = {
    queueName,
    shardIds: [...shardIds],
    updatedAt: now(),
  };

  await bindings.kvNamespace.put(key, JSON.stringify(shardMap));

  return shardMap;
};

export const ensureShardMap = async (
  queueName: string,
  namespaceName: string,
  bindings: QueueClientBindings,
  desiredShardCount: number
) => {
  const existing = await loadShardMap(queueName, bindings);

  if (existing) {
    return existing;
  }

  const namespace = bindings.durableObjects[namespaceName];

  if (!namespace) {
    throw new Error(`Durable object namespace ${namespaceName} not found`);
  }

  const shardIds = generateShardIds(queueName, desiredShardCount);
  const durableObjectIds = shardIds.map((shardId) =>
    namespace.idFromName(shardId).toString()
  );

  await persistShardMap(queueName, durableObjectIds, bindings);

  return loadShardMap(queueName, bindings);
};

const selectShardIndex = (shardIds: readonly string[], shardKey: string) => {
  const hash = hashStringToPositiveNumber(shardKey);

  return hash % shardIds.length;
};

export const selectShard = async (
  queueName: string,
  namespaceName: string,
  bindings: QueueClientBindings,
  desiredShardCount: number,
  shardKey: string
) => {
  const shardMap = await ensureShardMap(
    queueName,
    namespaceName,
    bindings,
    desiredShardCount
  );

  if (!shardMap) {
    throw new Error("Failed to initialise shard map");
  }

  const { shardIds } = shardMap;

  if (!shardIds || shardIds.length === 0) {
    throw new Error("No shards configured for queue");
  }

  const shardIndex = selectShardIndex(shardIds, shardKey);
  const shardId = shardIds[shardIndex];

  if (!shardId) {
    throw new Error("Failed to resolve shard identifier");
  }
  const namespace = bindings.durableObjects[namespaceName];

  if (!namespace) {
    throw new Error(`Durable object namespace ${namespaceName} not found`);
  }

  const stub = namespace.get(
    namespace.idFromString(shardId)
  ) as DurableObjectStub<any>;

  const shardSelection: QueueShardSelection = {
    shardId,
    stub,
  };

  return {
    shardSelection,
    shardMap,
  };
};

export const listShards = async (
  queueName: string,
  namespaceName: string,
  bindings: QueueClientBindings,
  desiredShardCount: number
) => {
  const shardMap = await ensureShardMap(
    queueName,
    namespaceName,
    bindings,
    desiredShardCount
  );

  if (!shardMap) {
    throw new Error("Failed to load shard map");
  }

  const namespace = bindings.durableObjects[namespaceName];

  if (!namespace) {
    throw new Error(`Durable object namespace ${namespaceName} not found`);
  }

  return shardMap.shardIds.map((shardId) => {
    if (!shardId) {
      throw new Error("Shard identifier is missing");
    }
    return {
      shardId,
      stub: namespace.get(
        namespace.idFromString(shardId)
      ) as DurableObjectStub<any>,
    } satisfies QueueShardSelection;
  });
};
