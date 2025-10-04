export type JobStatus = "waiting" | "delayed" | "active" | "dead";

export type BackoffStrategy = "none" | "fixed" | "linear" | "exponential";

export type BackoffSettings = {
  strategy: BackoffStrategy;
  delayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitterRatio?: number;
};

export type JobEnvelope<Data = unknown> = {
  id: string;
  data: Data;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  priority: number;
  delayUntil: number | null;
  createdAt: number;
  updatedAt: number;
  leaseToken: string | null;
  failReason: string | null;
  backoffSettings: BackoffSettings;
};

export type EnqueueOptions = {
  delayMs?: number;
  priority?: number;
  maxAttempts?: number;
  shardKey?: string;
  jobId?: string;
  backoffSettings?: Partial<BackoffSettings>;
};

export type ClaimOptions = {
  batchSize?: number;
};

export type ClaimResponse<Data = unknown> = {
  jobs: JobEnvelope<Data>[];
};

export type EnqueueResponse = {
  job: JobEnvelope;
  shardId: string;
};

export type CompleteResponse = {
  ok: boolean;
};

export type FailResponse = {
  ok: boolean;
  status: JobStatus;
};

export type ProcessDelayedResponse = {
  moved: number;
};

export type QueueStats = {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
};

export type QueueShardMap = {
  queueName: string;
  shardIds: string[];
  updatedAt: number;
};

export type QueueClientBindings = {
  kvNamespace: KVNamespace;
  durableObjects: Record<string, DurableObjectNamespace<any>>;
};

export type QueueClientOptions = {
  defaultShardCount?: number;
  defaultDurableObjectNamespace?: string;
  queues?: Record<string, QueueDefinition>;
};

export type QueueDurableObjectEnv = {
  queueName: string;
};

export type QueueDurableObjectContext = {
  state: DurableObjectState<any>;
  env: QueueDurableObjectEnv;
};

export type QueueShardSelection = {
  shardId: string;
  stub: DurableObjectStub;
};

export type DurableObjectFetchRequest = {
  op: string;
  payload?: unknown;
};

export type DurableObjectFetchResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  error?: string;
};

export type QueueDefinition = {
  durableObjectNamespace: string;
  shardCount?: number;
};
