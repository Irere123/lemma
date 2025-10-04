import {
  DEFAULT_BACKOFF_SETTINGS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_PRIORITY,
  WAITING_PREFIX,
  DELAYED_PREFIX,
  ACTIVE_PREFIX,
  DEAD_PREFIX,
} from "./constants.ts";
import {
  createActiveKey,
  createDeadKey,
  createDelayedKey,
  createJobKey,
  createMaxAttemptsKey,
  createWaitingKey,
} from "./helpers.ts";
import { computeBackoffDelay } from "./utils/backoff.ts";
import { generateJobId, generateLeaseToken } from "./utils/id.ts";
import { now } from "./utils/time.ts";
import type {
  BackoffSettings,
  ClaimOptions,
  ClaimResponse,
  CompleteResponse,
  DurableObjectFetchRequest,
  DurableObjectFetchResponse,
  EnqueueOptions,
  EnqueueResponse,
  FailResponse,
  JobEnvelope,
  ProcessDelayedResponse,
  QueueStats,
} from "./types.ts";

// type DurableObjectStorage = DurableObjectState["storage"];
// type DurableObjectTransaction = Parameters<
//   DurableObjectStorage["transaction"]
// >[0] extends (txn: infer T) => unknown
//   ? T
//   : never;

const parseRequest = async (request: Request) => {
  const json = await request.json();
  return json as DurableObjectFetchRequest;
};

const defaultBackoffSettings: BackoffSettings = DEFAULT_BACKOFF_SETTINGS;

export class QueueDurableObject {
  readonly #state: DurableObjectState;

  constructor(state: DurableObjectState, env: { queueName: string }) {
    this.#state = state;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const parsed = await parseRequest(request);
      const result = await this.#handleOperation(parsed);

      return Response.json({
        ok: true,
        result,
      } satisfies DurableObjectFetchResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  }

  async alarm() {
    await this.#processDelayedInternal();
  }

  async #handleOperation(request: DurableObjectFetchRequest) {
    const { op, payload } = request;

    if (op === "enqueue") {
      return this.#enqueue(
        payload as { jobData: unknown; options?: EnqueueOptions }
      );
    }

    if (op === "claim") {
      return this.#claim(payload as ClaimOptions);
    }

    if (op === "complete") {
      return this.#complete(payload as { jobId: string; leaseToken: string });
    }

    if (op === "fail") {
      return this.#fail(
        payload as { jobId: string; leaseToken: string; reason: string }
      );
    }

    if (op === "processDelayed") {
      return this.#processDelayedInternal();
    }

    if (op === "getStats") {
      return this.#getStats();
    }

    throw new Error(`Unknown operation: ${op}`);
  }

  async #enqueue({
    jobData,
    options,
  }: {
    jobData: unknown;
    options?: EnqueueOptions;
  }) {
    const {
      delayMs = 0,
      priority = DEFAULT_PRIORITY,
      maxAttempts = DEFAULT_MAX_ATTEMPTS,
    } = options ?? {};

    const backoffSettings: BackoffSettings = {
      ...defaultBackoffSettings,
      ...(options?.backoffSettings ?? {}),
    };

    const jobId = options?.jobId ?? generateJobId();
    const enqueueTime = now();
    const delayUntil = delayMs > 0 ? enqueueTime + delayMs : null;
    const status = delayUntil ? "delayed" : "waiting";

    const job: JobEnvelope = {
      id: jobId,
      data: jobData,
      status,
      attempts: 0,
      maxAttempts,
      priority,
      delayUntil,
      createdAt: enqueueTime,
      updatedAt: enqueueTime,
      leaseToken: null,
      failReason: null,
      backoffSettings,
    };

    const jobKey = createJobKey(jobId);
    const maxAttemptsKey = createMaxAttemptsKey(jobId);

    await this.#state.storage.transaction(async (txn) => {
      await txn.put(jobKey, job);
      await txn.put(maxAttemptsKey, maxAttempts);

      if (delayUntil) {
        await txn.put(createDelayedKey(delayUntil, jobId), "");
        await this.#ensureAlarm(delayUntil);
        return;
      }

      await txn.put(createWaitingKey(job), "");
    });

    return {
      job,
      shardId: this.#state.id.toString(),
    } satisfies EnqueueResponse;
  }

  async #claim(options?: ClaimOptions) {
    const batchSize = options?.batchSize ?? 1;
    const claimed: JobEnvelope[] = [];

    await this.#state.storage.transaction(async (txn) => {
      const waitingEntries = await txn.list({
        prefix: WAITING_PREFIX,
        limit: batchSize,
      });
      const orderedKeys = Array.from(waitingEntries.keys()).sort();

      for (const key of orderedKeys) {
        const jobId = key.split(":").pop();

        if (!jobId) {
          await txn.delete(key);
          continue;
        }

        const jobKey = createJobKey(jobId);
        const job = (await txn.get<JobEnvelope>(jobKey)) ?? null;

        if (!job) {
          await txn.delete(key);
          continue;
        }

        const leaseToken = generateLeaseToken();
        const updatedJob: JobEnvelope = {
          ...job,
          status: "active",
          attempts: job.attempts + 1,
          leaseToken,
          updatedAt: now(),
        };

        await txn.put(jobKey, updatedJob);
        await txn.delete(key);
        await txn.put(createActiveKey(jobId), leaseToken);
        claimed.push(updatedJob);

        if (claimed.length >= batchSize) {
          break;
        }
      }
    });

    return { jobs: claimed } satisfies ClaimResponse;
  }

  async #complete({
    jobId,
    leaseToken,
  }: {
    jobId: string;
    leaseToken: string;
  }) {
    const jobKey = createJobKey(jobId);
    const activeKey = createActiveKey(jobId);

    let ok = false;

    await this.#state.storage.transaction(async (txn) => {
      const activeLease = (await txn.get(activeKey)) as string | null;

      if (!activeLease || activeLease !== leaseToken) {
        return;
      }

      await txn.delete(jobKey);
      await txn.delete(activeKey);
      await txn.delete(createMaxAttemptsKey(jobId));
      ok = true;
    });

    return { ok } satisfies CompleteResponse;
  }

  async #fail({
    jobId,
    leaseToken,
    reason,
  }: {
    jobId: string;
    leaseToken: string;
    reason: string;
  }) {
    const jobKey = createJobKey(jobId);
    const activeKey = createActiveKey(jobId);
    let response: FailResponse = { ok: false, status: "active" };

    await this.#state.storage.transaction(async (txn) => {
      const activeLease = (await txn.get(activeKey)) as string | null;

      if (!activeLease || activeLease !== leaseToken) {
        response = { ok: false, status: "active" };
        return;
      }

      const job = (await txn.get<JobEnvelope>(jobKey)) ?? null;

      if (!job) {
        await txn.delete(activeKey);
        response = { ok: false, status: "active" };
        return;
      }

      const maxAttempts = job.maxAttempts;
      const attempts = job.attempts;

      const updatedJob: JobEnvelope = {
        ...job,
        leaseToken: null,
        updatedAt: now(),
        failReason: reason,
      };

      if (attempts >= maxAttempts) {
        updatedJob.status = "dead";
        await txn.put(jobKey, updatedJob);
        await txn.delete(activeKey);
        await txn.put(createDeadKey(jobId), reason);
        response = { ok: true, status: "dead" };
        return;
      }

      const backoffSettings = job.backoffSettings ?? defaultBackoffSettings;
      const delay = computeBackoffDelay(attempts, backoffSettings);

      if (delay > 0) {
        const delayUntil = updatedJob.updatedAt + delay;
        updatedJob.status = "delayed";
        updatedJob.delayUntil = delayUntil;
        await txn.put(createDelayedKey(delayUntil, jobId), "");
        await this.#ensureAlarm(delayUntil);
      } else {
        updatedJob.status = "waiting";
        updatedJob.delayUntil = null;
        await txn.put(createWaitingKey(updatedJob), "");
      }

      await txn.put(jobKey, updatedJob);
      await txn.delete(activeKey);
      response = { ok: true, status: updatedJob.status };
    });

    return response satisfies FailResponse;
  }

  async #processDelayedInternal() {
    const nowTs = now();
    let moved = 0;

    await this.#state.storage.transaction(async (txn) => {
      const delayedEntries = await txn.list({
        prefix: DELAYED_PREFIX,
        limit: 128,
      });
      const orderedKeys = Array.from(delayedEntries.keys()).sort();

      for (const key of orderedKeys) {
        const parts = key.split(":");
        const delayUntil = Number(parts[1]);

        if (Number.isNaN(delayUntil) || delayUntil > nowTs) {
          continue;
        }

        const jobId = parts[2];

        if (!jobId) {
          await txn.delete(key);
          continue;
        }

        const jobKey = createJobKey(jobId);
        const job = (await txn.get<JobEnvelope>(jobKey)) ?? null;

        if (!job) {
          await txn.delete(key);
          continue;
        }

        const updatedJob: JobEnvelope = {
          ...job,
          status: "waiting",
          delayUntil: null,
          updatedAt: nowTs,
        };

        await txn.put(jobKey, updatedJob);
        await txn.put(createWaitingKey(updatedJob), "");
        await txn.delete(key);
        moved += 1;
      }
      await this.#scheduleNextAlarm(txn);
    });

    return { moved } satisfies ProcessDelayedResponse;
  }

  async #findNextDelayed(
    storage: DurableObjectStorage | DurableObjectTransaction
  ) {
    const entries = await storage.list({ prefix: DELAYED_PREFIX, limit: 1 });
    const firstKey = Array.from(entries.keys())[0];

    if (!firstKey) {
      return null;
    }

    const parts = firstKey.split(":");
    const delayUntil = Number(parts[1]);

    if (Number.isNaN(delayUntil)) {
      return null;
    }

    return delayUntil;
  }

  async #scheduleNextAlarm(storage: DurableObjectTransaction) {
    const nextDelayed = await this.#findNextDelayed(storage);

    if (nextDelayed) {
      const current = await this.#state.storage.getAlarm();

      if (!current || nextDelayed < current) {
        await this.#state.storage.setAlarm(nextDelayed);
      }

      return;
    }

    await this.#state.storage.deleteAlarm();
  }

  async #getStats() {
    let waiting = 0;
    let active = 0;
    let failed = 0;
    let delayed = 0;

    const waitingEntries = await this.#state.storage.list({
      prefix: WAITING_PREFIX,
    });

    for (const _ of waitingEntries) {
      waiting += 1;
    }

    const activeEntries = await this.#state.storage.list({
      prefix: ACTIVE_PREFIX,
    });

    for (const _ of activeEntries) {
      active += 1;
    }

    const failedEntries = await this.#state.storage.list({
      prefix: DEAD_PREFIX,
    });

    for (const _ of failedEntries) {
      failed += 1;
    }

    const delayedEntries = await this.#state.storage.list({
      prefix: DELAYED_PREFIX,
    });

    for (const _ of delayedEntries) {
      delayed += 1;
    }

    return {
      waiting,
      active,
      failed,
      delayed,
    } satisfies QueueStats;
  }

  async #ensureAlarm(timestamp: number) {
    const currentAlarm = await this.#state.storage.getAlarm();

    if (!currentAlarm || timestamp < currentAlarm) {
      await this.#state.storage.setAlarm(timestamp);
    }
  }
}
