import type { BackoffSettings } from "../types.ts";

const clampDelay = (delay: number, maxDelay?: number) => {
  if (typeof maxDelay !== "number" || Number.isNaN(maxDelay)) {
    return delay;
  }

  if (delay > maxDelay) {
    return maxDelay;
  }

  return delay;
};

const withJitter = (delay: number, jitterRatio?: number) => {
  if (typeof jitterRatio !== "number" || jitterRatio <= 0) {
    return delay;
  }

  const jitter = delay * jitterRatio;
  const min = delay - jitter;
  const max = delay + jitter;

  return Math.random() * (max - min) + min;
};

export const computeBackoffDelay = (
  attempt: number,
  settings: BackoffSettings
) => {
  const {
    strategy,
    delayMs = 0,
    factor = 2,
    maxDelayMs,
    jitterRatio,
  } = settings;

  if (strategy === "none") {
    return 0;
  }

  if (strategy === "fixed") {
    return clampDelay(withJitter(delayMs, jitterRatio), maxDelayMs);
  }

  if (strategy === "linear") {
    const base = delayMs || 1000;
    const delay = attempt * base;

    return clampDelay(withJitter(delay, jitterRatio), maxDelayMs);
  }

  const base = delayMs || 1000;
  const calcFactor = factor <= 1 ? 2 : factor;
  const delay = base * calcFactor ** (attempt - 1);

  return clampDelay(withJitter(delay, jitterRatio), maxDelayMs);
};
