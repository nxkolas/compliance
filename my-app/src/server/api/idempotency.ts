import { createHash } from "node:crypto";
import { ApiError } from "./errors";

export type IdempotencyRecord = {
  actorKey: string;
  scope: string;
  operation: string;
  key: string;
  requestFingerprint: string;
  state: "in_progress" | "succeeded" | "failed";
  responseStatus?: number;
  resultReference?: { type: string; id: string };
};

export type IdempotencyClaim =
  | { kind: "started"; record: IdempotencyRecord }
  | { kind: "replay"; record: IdempotencyRecord };

export interface IdempotencyRepository {
  create(record: IdempotencyRecord): Promise<boolean>;
  find(input: Pick<IdempotencyRecord, "actorKey" | "scope" | "operation" | "key">): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}

export function fingerprintRequest(input: unknown) {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

export function requireIdempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) {
    throw new ApiError(400, "Idempotency-Key is required", undefined, "IDEMPOTENCY_KEY_REQUIRED");
  }
  if (key.length > 255 || !/^[\x21-\x7E]+$/.test(key)) {
    throw new ApiError(400, "Idempotency-Key is invalid", undefined, "INVALID_IDEMPOTENCY_KEY");
  }
  return key;
}

export async function claimIdempotency(
  repository: IdempotencyRepository,
  input: Omit<IdempotencyRecord, "state">,
): Promise<IdempotencyClaim> {
  const started: IdempotencyRecord = { ...input, state: "in_progress" };
  if (await repository.create(started)) return { kind: "started", record: started };

  const existing = await repository.find(input);
  if (!existing) {
    throw new ApiError(409, "Idempotency claim raced with another request", undefined, "IDEMPOTENCY_IN_PROGRESS");
  }
  if (existing.requestFingerprint !== input.requestFingerprint) {
    throw new ApiError(409, "Idempotency key was reused with different input", undefined, "IDEMPOTENCY_KEY_REUSED");
  }
  if (existing.state === "succeeded") return { kind: "replay", record: existing };
  if (existing.state === "failed") {
    const restarted = { ...existing, state: "in_progress" as const, responseStatus: undefined, resultReference: undefined };
    await repository.save(restarted);
    return { kind: "started", record: restarted };
  }

  throw new ApiError(409, "An operation with this idempotency key is already in progress", undefined, "IDEMPOTENCY_IN_PROGRESS");
}

export async function runIdempotentCommand<T>(input: {
  repository: IdempotencyRepository;
  request: Request;
  actorKey: string;
  scope: string;
  operation: string;
  requestInput: unknown;
  resultType: string;
  execute: () => Promise<T>;
  resultId: (value: T) => string;
  replay: (id: string) => Promise<T>;
  responseStatus: number;
}) {
  const claim = await claimIdempotency(input.repository, {
    actorKey: input.actorKey,
    scope: input.scope,
    operation: input.operation,
    key: requireIdempotencyKey(input.request),
    requestFingerprint: fingerprintRequest(input.requestInput),
  });
  if (claim.kind === "replay") {
    const reference = claim.record.resultReference;
    if (!reference || reference.type !== input.resultType) {
      throw new ApiError(409, "Idempotent result is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE");
    }
    return { value: await input.replay(reference.id), reused: true };
  }
  try {
    const value = await input.execute();
    await completeIdempotency(input.repository, claim.record, {
      responseStatus: input.responseStatus,
      resultReference: { type: input.resultType, id: input.resultId(value) },
    });
    return { value, reused: false };
  } catch (error) {
    await failIdempotency(input.repository, claim.record);
    throw error;
  }
}

export async function completeIdempotency(
  repository: IdempotencyRepository,
  record: IdempotencyRecord,
  result: { responseStatus: number; resultReference: { type: string; id: string } },
) {
  await repository.save({ ...record, ...result, state: "succeeded" });
}

export async function failIdempotency(
  repository: IdempotencyRepository,
  record: IdempotencyRecord,
) {
  await repository.save({ ...record, state: "failed" });
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}
