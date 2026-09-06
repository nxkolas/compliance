import { ApiError } from "./errors";

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export interface RateLimitStore {
  increment(key: string, windowStartedAt: Date, expiresAt: Date): Promise<number>;
}

export async function enforceRateLimit(input: {
  store: RateLimitStore;
  subject: string;
  scope: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
}): Promise<RateLimitDecision> {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1) {
    throw new Error("Rate-limit count must be a positive integer");
  }
  if (!Number.isSafeInteger(input.windowSeconds) || input.windowSeconds < 1) {
    throw new Error("Rate-limit window must be a positive integer");
  }
  const now = input.now ?? new Date();
  const windowMilliseconds = input.windowSeconds * 1000;
  const windowStartedAt = new Date(Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds);
  const expiresAt = new Date(windowStartedAt.getTime() + windowMilliseconds);
  const count = await input.store.increment(
    `${input.scope}:${input.subject}`,
    windowStartedAt,
    expiresAt,
  );
  const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

  if (count > input.limit) {
    throw new ApiError(
      429,
      "Too many requests",
      { retryAfterSeconds },
      "RATE_LIMITED",
      { "retry-after": String(retryAfterSeconds) },
    );
  }

  return {
    allowed: true,
    remaining: Math.max(0, input.limit - count),
    retryAfterSeconds,
  };
}
