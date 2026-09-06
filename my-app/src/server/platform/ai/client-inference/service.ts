import { and, asc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { clientInferenceRequests } from "@/src/db/schema";
import { contentHash } from "@/src/server/platform/canonical-json";
import { ApiError } from "@/src/server/platform/http/errors";
import type {
  ClientInferenceKind,
  ClientInferenceRequestPayload,
  ClientInferenceRequestRow,
} from "./types";

/**
 * How long a request stays claimable by one client before another may take it.
 * Refreshed by heartbeats, so a slow local model holds its claim as long as the
 * tab is alive and loses it promptly when the tab closes.
 */
export const CLIENT_LEASE_SECONDS = 90;

/** How long an unanswered request stays open before it stops being offered. */
export const CLIENT_REQUEST_TTL_SECONDS = 30 * 60;

/**
 * How long one client may hold a claim while its local model works. Bounds the
 * harm a hostile member can do by claiming every request and heartbeating
 * forever: past this, heartbeats are refused, the lease lapses, and the
 * request becomes claimable by someone who will actually answer it.
 */
export const MAX_CLIENT_CLAIM_DURATION_MS = 15 * 60 * 1_000;

/**
 * How many open claims one user may hold per organization. The relay worker is
 * serial by design, so a legitimate browser holds one claim at a time (a few
 * tabs, a few claims). A hostile member can therefore park at most this many
 * requests, not the organization's whole queue.
 */
export const MAX_CLAIMS_PER_USER = 3;

/**
 * Identifies one inference call by exactly what was asked.
 *
 * A parked job re-executes from the beginning when it wakes, so every call it
 * makes must be recognisable as one already answered. Hashing the payload does
 * that without the caller having to thread an identifier through the grounding
 * stack.
 */
export function inferenceInputHash(input: {
  kind: ClientInferenceKind;
  modelId: string;
  payload: ClientInferenceRequestPayload;
}) {
  return contentHash({
    version: 1,
    kind: input.kind,
    modelId: input.modelId,
    payload: input.payload,
  });
}

/**
 * Returns the answered request for this exact input, or registers a pending one.
 *
 * The unique index on (organization, job, input hash) makes concurrent callers
 * converge on a single row rather than queueing the same work twice, which
 * matters because category generation runs several calls in parallel.
 */
export async function requestClientInference(input: {
  organizationId: string;
  kind: ClientInferenceKind;
  jobId: string | null;
  runId: string | null;
  modelId: string;
  payload: ClientInferenceRequestPayload;
  now?: Date;
}): Promise<ClientInferenceRequestRow> {
  const now = input.now ?? new Date();
  const inputHash = inferenceInputHash({
    kind: input.kind,
    modelId: input.modelId,
    payload: input.payload,
  });

  const existing = await readByInputHash(
    input.organizationId,
    input.jobId,
    inputHash,
  );
  if (existing) return existing;

  const [created] = await db
    .insert(clientInferenceRequests)
    .values({
      organizationId: input.organizationId,
      kind: input.kind,
      jobId: input.jobId,
      runId: input.runId,
      requestPayload: input.payload,
      inputHash,
      modelId: input.modelId,
      status: "pending",
      expiresAt: new Date(now.getTime() + CLIENT_REQUEST_TTL_SECONDS * 1_000),
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost the insert race against a sibling category worker; its row is the one.
  const raced = await readByInputHash(
    input.organizationId,
    input.jobId,
    inputHash,
  );
  if (!raced) throw new Error("Client inference request was not created");
  return raced;
}

async function readByInputHash(
  organizationId: string,
  jobId: string | null,
  inputHash: string,
) {
  const [row] = await db
    .select()
    .from(clientInferenceRequests)
    .where(
      and(
        eq(clientInferenceRequests.organizationId, organizationId),
        jobId === null
          ? sql`${clientInferenceRequests.jobId} is null`
          : eq(clientInferenceRequests.jobId, jobId),
        eq(clientInferenceRequests.inputHash, inputHash),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Hands the oldest open request for one organization to a client.
 *
 * Scoped to the caller's organization by the caller, and again here, so a
 * client can never see work belonging to another tenant. Expired claims are
 * reclaimable: a closed tab must not strand a job until its own timeout.
 */
export async function claimClientInference(input: {
  organizationId: string;
  userId: string;
  now?: Date;
}): Promise<ClientInferenceRequestRow | null> {
  const now = input.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + CLIENT_LEASE_SECONDS * 1_000);

  return db.transaction(async (tx) => {
    const [held] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(clientInferenceRequests)
      .where(
        and(
          eq(clientInferenceRequests.organizationId, input.organizationId),
          eq(clientInferenceRequests.claimedBy, input.userId),
          eq(clientInferenceRequests.status, "claimed"),
        ),
      );
    if (Number(held?.count ?? 0) >= MAX_CLAIMS_PER_USER) return null;

    const [candidate] = await tx
      .select({ id: clientInferenceRequests.id })
      .from(clientInferenceRequests)
      .where(
        and(
          eq(clientInferenceRequests.organizationId, input.organizationId),
          gt(clientInferenceRequests.expiresAt, now),
          or(
            eq(clientInferenceRequests.status, "pending"),
            and(
              eq(clientInferenceRequests.status, "claimed"),
              lt(clientInferenceRequests.leaseExpiresAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(clientInferenceRequests.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;

    const [claimed] = await tx
      .update(clientInferenceRequests)
      .set({
        status: "claimed",
        claimedBy: input.userId,
        claimedAt: now,
        heartbeatAt: now,
        leaseExpiresAt,
        attemptCount: sql`${clientInferenceRequests.attemptCount} + 1`,
      })
      .where(eq(clientInferenceRequests.id, candidate.id))
      .returning();
    return claimed ?? null;
  });
}

/** Extends a claim while the local model is still working. */
export async function heartbeatClientInference(input: {
  organizationId: string;
  requestId: string;
  userId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [row] = await db
    .update(clientInferenceRequests)
    .set({
      heartbeatAt: now,
      leaseExpiresAt: new Date(now.getTime() + CLIENT_LEASE_SECONDS * 1_000),
    })
    .where(
      and(
        eq(clientInferenceRequests.id, input.requestId),
        eq(clientInferenceRequests.organizationId, input.organizationId),
        eq(clientInferenceRequests.claimedBy, input.userId),
        eq(clientInferenceRequests.status, "claimed"),
        gt(
          clientInferenceRequests.claimedAt,
          new Date(now.getTime() - MAX_CLIENT_CLAIM_DURATION_MS),
        ),
      ),
    )
    .returning();
  if (!row) throw claimLost();
  return row;
}

/**
 * Records what a client's model returned.
 *
 * The response is stored, not trusted. Admissibility is decided by the
 * grounding gateway when the parked job resumes and revalidates every claim
 * against server-held context.
 */
export async function submitClientInference(input: {
  organizationId: string;
  requestId: string;
  userId: string;
  response: unknown;
  reportedModelId?: string | null;
  attestedUsage?: { inputTokens?: number; outputTokens?: number } | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [row] = await db
    .update(clientInferenceRequests)
    .set({
      status: "succeeded",
      response: input.response as never,
      // Recorded, not enforced. A model id that differs from the one requested
      // is worth seeing in an audit -- servers normalise tags, and a user can
      // repoint their model between the claim and the answer -- but rejecting
      // on a string mismatch would fail legitimate runs over naming, and it
      // proves nothing either way: the client is the only witness.
      reportedModelId: input.reportedModelId ?? null,
      attestedInputTokens: input.attestedUsage?.inputTokens ?? null,
      attestedOutputTokens: input.attestedUsage?.outputTokens ?? null,
      respondedAt: now,
      leaseExpiresAt: null,
    })
    .where(
      and(
        eq(clientInferenceRequests.id, input.requestId),
        eq(clientInferenceRequests.organizationId, input.organizationId),
        eq(clientInferenceRequests.claimedBy, input.userId),
        eq(clientInferenceRequests.status, "claimed"),
      ),
    )
    .returning();
  if (!row) throw claimLost();
  return row;
}

/** Records that a client could not run the request. */
export async function failClientInference(input: {
  organizationId: string;
  requestId: string;
  userId: string;
  failureCode: string;
  failureMessage: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [row] = await db
    .update(clientInferenceRequests)
    .set({
      status: "failed",
      failureCode: input.failureCode,
      failureMessage: input.failureMessage.slice(0, 500),
      respondedAt: now,
      leaseExpiresAt: null,
    })
    .where(
      and(
        eq(clientInferenceRequests.id, input.requestId),
        eq(clientInferenceRequests.organizationId, input.organizationId),
        eq(clientInferenceRequests.claimedBy, input.userId),
        eq(clientInferenceRequests.status, "claimed"),
      ),
    )
    .returning();
  if (!row) throw claimLost();
  return row;
}

/**
 * Marks requests nobody answered in time. Called from the cleanup job so a job
 * parked behind a client that never came back fails with a clear reason instead
 * of waiting for its own outer timeout.
 */
export async function expireStaleClientInference(now = new Date()) {
  const expired = await db
    .update(clientInferenceRequests)
    .set({
      status: "expired",
      failureCode: "CLIENT_INFERENCE_EXPIRED",
      failureMessage: "No client answered this request before it expired.",
      respondedAt: now,
      leaseExpiresAt: null,
    })
    .where(
      and(
        inArray(clientInferenceRequests.status, ["pending", "claimed"]),
        lt(clientInferenceRequests.expiresAt, now),
      ),
    )
    .returning({ id: clientInferenceRequests.id });
  return expired.length;
}

export async function readClientInferenceRequest(
  organizationId: string,
  requestId: string,
) {
  const [row] = await db
    .select()
    .from(clientInferenceRequests)
    .where(
      and(
        eq(clientInferenceRequests.id, requestId),
        eq(clientInferenceRequests.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

function claimLost() {
  return new ApiError(
    409,
    "This inference request is no longer claimed by you",
    undefined,
    "CLIENT_INFERENCE_CLAIM_LOST",
  );
}
