export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the next request would be accepted. 0 when allowed. */
  retryAfterSeconds: number;
}

/** Counts requests per key. Swap the implementation to share limits across processes. */
export interface RateLimiter {
  /** Records one request for `key` and says whether it is within the limit. */
  check(key: string): RateLimitDecision;
}

export interface SlidingWindowOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

const SWEEP_EVERY = 500;

/**
 * In-memory sliding-window limiter: at most `limit` requests in any `windowMs`
 * span, per key. Exact (no burst at window edges), and bounded in memory
 * because idle keys are swept.
 */
export function createSlidingWindowLimiter(options: SlidingWindowOptions): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();
  let checks = 0;

  function sweep(cutoff: number) {
    for (const [key, timestamps] of hits) {
      if ((timestamps.at(-1) ?? 0) <= cutoff) hits.delete(key);
    }
  }

  return {
    check(key) {
      const time = now();
      const cutoff = time - windowMs;
      checks += 1;
      if (checks % SWEEP_EVERY === 0) sweep(cutoff);

      const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? time;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - time) / 1000)),
        };
      }
      recent.push(time);
      hits.set(key, recent);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
