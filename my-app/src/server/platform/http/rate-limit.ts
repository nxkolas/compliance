import { apiRateLimitWindows } from "@/src/db/schema";
import { sql } from "drizzle-orm";
import { ApiError } from "./errors";

const policies = {
  "uploads:create": { limit: 30, windowSeconds: 60 },
  "uploads:complete": { limit: 20, windowSeconds: 60 },
  "gap:generate": { limit: 5, windowSeconds: 300 },
  "plans:generate": { limit: 5, windowSeconds: 300 },
  "reports:create": { limit: 5, windowSeconds: 300 },
  "invitations:write": { limit: 20, windowSeconds: 3600 },
  "jobs:poll": { limit: 120, windowSeconds: 60 },
  "client-inference:claim": { limit: 60, windowSeconds: 60 },
  "client-inference:heartbeat": { limit: 60, windowSeconds: 60 },
  "client-inference:result": { limit: 30, windowSeconds: 60 },
  "client-inference:failure": { limit: 30, windowSeconds: 60 },
} as const;

const apiRequestPolicy = { limit: 300, windowSeconds: 60 } as const;

type RateLimitedOperation = keyof typeof policies;

export function enforceOperationRateLimit(input: {
  userId: string;
  operation: RateLimitedOperation;
  scopeId?: string;
}) {
  return enforceRateLimit(
    `${input.operation}:${input.userId}:${input.scopeId ?? "global"}`,
    policies[input.operation],
  );
}

export function enforceApiRequestRateLimit(request: Pick<Request, "headers">) {
  const forwardedAddress = request.headers
    .get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  const subject =
    forwardedAddress || request.headers.get("x-real-ip")?.trim() || "unknown";

  return enforceRateLimit(`api:all:${subject}`, apiRequestPolicy);
}

async function enforceRateLimit(
  key: string,
  policy: { limit: number; windowSeconds: number },
) {
  const now = new Date();
  const windowMilliseconds = policy.windowSeconds * 1000;
  const windowStartedAt = new Date(Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds);
  const expiresAt = new Date(windowStartedAt.getTime() + windowMilliseconds);
  const { db } = await import("@/src/db");
  const [window] = await db
    .insert(apiRateLimitWindows)
    .values({ key, windowStartedAt, expiresAt, requestCount: 1 })
    .onConflictDoUpdate({
      target: [apiRateLimitWindows.key, apiRateLimitWindows.windowStartedAt],
      set: { requestCount: sql`${apiRateLimitWindows.requestCount} + 1` },
    })
    .returning({ count: apiRateLimitWindows.requestCount });
  const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

  if (window.count > policy.limit) {
    throw new ApiError(
      429,
      "Too many requests",
      { retryAfterSeconds },
      "RATE_LIMITED",
      { "retry-after": String(retryAfterSeconds) },
    );
  }
}
