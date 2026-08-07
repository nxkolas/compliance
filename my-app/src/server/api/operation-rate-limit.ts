import { enforceRateLimit } from "./rate-limit";
import { databaseRateLimitStore } from "@/src/server/rate-limit/database-store";

const policies = {
  "uploads:create": { limit: 30, windowSeconds: 60 },
  "uploads:complete": { limit: 20, windowSeconds: 60 },
  "gap:generate": { limit: 5, windowSeconds: 300 },
  "plans:generate": { limit: 5, windowSeconds: 300 },
  "reports:create": { limit: 5, windowSeconds: 300 },
  "invitations:write": { limit: 20, windowSeconds: 3600 },
  "corpus:operate": { limit: 20, windowSeconds: 300 },
  "jobs:poll": { limit: 120, windowSeconds: 60 },
  "client-inference:claim": { limit: 60, windowSeconds: 60 },
  "client-inference:heartbeat": { limit: 60, windowSeconds: 60 },
  "client-inference:result": { limit: 30, windowSeconds: 60 },
  "client-inference:failure": { limit: 30, windowSeconds: 60 },
} as const;

export type RateLimitedOperation = keyof typeof policies;

export function enforceOperationRateLimit(input: {
  userId: string;
  operation: RateLimitedOperation;
  scopeId?: string;
}) {
  const policy = policies[input.operation];
  return enforceRateLimit({
    store: databaseRateLimitStore,
    subject: `${input.userId}:${input.scopeId ?? "global"}`,
    scope: input.operation,
    ...policy,
  });
}
