export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_PRIORITY = 5;
export const PRIORITY_MAX = 99;
export const PRIORITY_MIN = 0;
export const WAITING_PREFIX = "waiting";
export const DELAYED_PREFIX = "delayed";
export const ACTIVE_PREFIX = "active";
export const JOB_KEY_PREFIX = "job";
export const DEAD_PREFIX = "dead";
export const META_MAX_ATTEMPTS_PREFIX = "meta:max-attempts";
export const DEFAULT_BACKOFF = {
  strategy: "none",
} as const;
export const DEFAULT_BACKOFF_SETTINGS = Object.freeze(DEFAULT_BACKOFF);
export const DEFAULT_SHARD_COUNT = 4;
