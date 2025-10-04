import type { JobEnvelope } from "./types.ts";
import {
  ACTIVE_PREFIX,
  DEAD_PREFIX,
  DELAYED_PREFIX,
  JOB_KEY_PREFIX,
  META_MAX_ATTEMPTS_PREFIX,
  WAITING_PREFIX,
} from "./constants.ts";

export const createJobKey = (jobId: string) => {
  return `${JOB_KEY_PREFIX}:${jobId}`;
};

const createPriorityLabel = (priority: number) => {
  return priority.toString().padStart(5, "0");
};

export const createWaitingKey = (job: JobEnvelope) => {
  const priority = createPriorityLabel(job.priority);
  return `${WAITING_PREFIX}:${priority}:${job.createdAt}:${job.id}`;
};

export const createDelayedKey = (delayUntil: number, jobId: string) => {
  return `${DELAYED_PREFIX}:${delayUntil}:${jobId}`;
};

export const createActiveKey = (jobId: string) => {
  return `${ACTIVE_PREFIX}:${jobId}`;
};

export const createDeadKey = (jobId: string) => {
  return `${DEAD_PREFIX}:${jobId}`;
};

export const createMaxAttemptsKey = (jobId: string) => {
  return `${META_MAX_ATTEMPTS_PREFIX}:${jobId}`;
};
