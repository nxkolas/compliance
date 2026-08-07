import type { JobDto, JobProgressPhase } from "@/src/contracts/common/jobs";
import { db } from "@/src/db";
import { aiProcessingRuns, backgroundJobs } from "@/src/db/schema";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand } from "../auth/organization-scope";
import { ApiError } from "../api/errors";
import { and, asc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  JOB_KINDS,
  getJobDefinition,
  projectJobResult,
  validateJobCommand,
  type BackgroundJobRecord,
  type JobCommand,
  type JobResultLocator,
} from "./definitions";

type JobExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type EnqueueJobOptions = {
  executor?: JobExecutor;
  jobId?: string;
  runAfter?: Date;
  onConflictDoNothing?: boolean;
};

export function enqueueJob(
  command: JobCommand,
  options: EnqueueJobOptions & { onConflictDoNothing: true },
): Promise<BackgroundJobRecord | null>;
export function enqueueJob(
  command: JobCommand,
  options?: EnqueueJobOptions & { onConflictDoNothing?: false },
): Promise<BackgroundJobRecord>;
export async function enqueueJob(command: JobCommand, options: EnqueueJobOptions = {}) {
  const input = validateJobCommand(command);
  const executor = options.executor ?? db;
  let insert = executor.insert(backgroundJobs).values({
    id: options.jobId,
    kind: input.kind,
    payload: input.payload,
    organizationId: input.organizationId,
    requestedBy: input.requestedByUserId,
    maxAttempts: input.maxAttempts,
    availableAt: options.runAfter ?? new Date(),
  });
  if (options.onConflictDoNothing) insert = insert.onConflictDoNothing() as typeof insert;
  const [job] = await insert.returning();
  if (options.onConflictDoNothing && !job) return null;
  if (!job) throw new Error("Job was not created");
  return job;
}

export async function getAuthorizedJob(userId: string, jobId: string) {
  const job = await db.query.backgroundJobs.findFirst({
    where: { RAW: (table, operators) => eq(table.id, jobId) ?? operators.sql`true` },
  });
  if (!job?.organizationId) throw new ApiError(404, "Job not found", undefined, "JOB_NOT_FOUND");
  const capability = getJobDefinition(job.kind).readCapability;
  if (!capability) throw new ApiError(404, "Job not found", undefined, "JOB_NOT_FOUND");
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId: job.organizationId, capability });
  const authorizedJob = await executor.query.backgroundJobs.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, jobId), eq(table.organizationId, job.organizationId!)) ?? operators.sql`true` },
  });
  if (!authorizedJob) throw new ApiError(404, "Job not found", undefined, "JOB_NOT_FOUND");
  return toJobDto(authorizedJob);
}

export async function leaseNextJob(input: {
  workerId: string;
    kinds?: string[];
  leaseSeconds: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + input.leaseSeconds * 1000);
  return db.transaction(async (tx) => {
    const [candidate] = await tx.select().from(backgroundJobs).where(and(
      inArray(
        backgroundJobs.kind,
        (input.kinds ?? [...JOB_KINDS]) as BackgroundJobRecord["kind"][],
      ),
      or(
        and(eq(backgroundJobs.state, "queued"), lte(backgroundJobs.availableAt, now)),
        and(inArray(backgroundJobs.state, ["leased", "running"]), isNotNull(backgroundJobs.leaseExpiresAt), lte(backgroundJobs.leaseExpiresAt, now)),
      ),
    )).orderBy(asc(backgroundJobs.availableAt), asc(backgroundJobs.createdAt)).limit(1).for("update", { skipLocked: true });
    if (!candidate) return null;
    if (candidate.attemptCount >= candidate.maxAttempts) {
      await tx.update(backgroundJobs).set({ state: "failed", errorCode: "JOB_ATTEMPTS_EXHAUSTED", errorMessage: "The job exhausted its retry limit.", finishedAt: now, updatedAt: now }).where(eq(backgroundJobs.id, candidate.id));
      return null;
    }
    const [leased] = await tx.update(backgroundJobs).set({
      state: "running",
      attemptCount: candidate.attemptCount + 1,
      leaseOwner: input.workerId,
      leaseExpiresAt: expiresAt,
      heartbeatAt: now,
      startedAt: candidate.startedAt ?? now,
      updatedAt: now,
    }).where(eq(backgroundJobs.id, candidate.id)).returning();
    return leased ?? null;
  });
}

export async function heartbeatJob(input: { jobId: string; workerId: string; leaseSeconds: number; now?: Date }) {
  const now = input.now ?? new Date();
  const [job] = await db.update(backgroundJobs).set({
    heartbeatAt: now,
    leaseExpiresAt: new Date(now.getTime() + input.leaseSeconds * 1000),
    updatedAt: now,
  }).where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.leaseOwner, input.workerId), eq(backgroundJobs.state, "running"))).returning();
  if (!job) throw leaseLost();
  return job;
}

export async function advanceJobProgress(input: {
  jobId: string;
  workerId: string;
  progress: number;
  phase: JobProgressPhase;
  completedUnits?: number;
  totalUnits?: number;
  now?: Date;
}) {
  const total = input.totalUnits ?? 100;
  const current = input.completedUnits ?? Math.max(0, Math.min(total, Math.trunc(input.progress * total / 100)));
  const [job] = await db.update(backgroundJobs).set({
    progressCurrent: current,
    progressTotal: total,
    progressMessage: input.phase,
    updatedAt: input.now ?? new Date(),
  }).where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.leaseOwner, input.workerId), eq(backgroundJobs.state, "running"))).returning();
  if (!job) throw leaseLost();
  return job;
}

export async function succeedJob(input: { jobId: string; workerId: string; result: JobResultLocator; now?: Date }) {
  const now = input.now ?? new Date();
  const [job] = await db.update(backgroundJobs).set({
    state: "succeeded",
    resultLocator: input.result ?? null,
    progressCurrent: sql`coalesce(${backgroundJobs.progressTotal}, 100)`,
    progressTotal: sql`coalesce(${backgroundJobs.progressTotal}, 100)`,
    progressMessage: "completed",
    errorCode: null,
    errorMessage: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    finishedAt: now,
    updatedAt: now,
  }).where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.leaseOwner, input.workerId), eq(backgroundJobs.state, "running"))).returning();
  if (!job) throw leaseLost();
  return job;
}

/**
 * Returns a job to the queue because it is waiting on something outside the
 * server, without counting the wait as a failed attempt.
 *
 * A self-hosted organization's generation is many separate model calls, each
 * one parked until its browser answers. Routing that through `failJob` would
 * work mechanically -- it also re-queues -- but every park would consume a
 * retry, and a ten-category analysis would exhaust `maxAttempts` long before
 * finishing. The attempt taken at lease time is refunded here instead, so the
 * retry budget keeps meaning "attempts that went wrong".
 */
export async function parkJob(input: {
  jobId: string;
  workerId: string;
  reason: string;
  retryAfterSeconds: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [job] = await db.update(backgroundJobs).set({
    state: "queued",
    availableAt: new Date(now.getTime() + input.retryAfterSeconds * 1_000),
    attemptCount: sql`greatest(${backgroundJobs.attemptCount} - 1, 0)`,
    progressMessage: input.reason,
    leaseOwner: null,
    leaseExpiresAt: null,
    finishedAt: null,
    updatedAt: now,
  }).where(and(
    eq(backgroundJobs.id, input.jobId),
    eq(backgroundJobs.leaseOwner, input.workerId),
    eq(backgroundJobs.state, "running"),
  )).returning();
  if (!job) throw leaseLost();
  return job;
}

/**
 * Makes a job waiting on a client answer immediately leaseable again.
 *
 * A parked job's `availableAt` sits at the client lease horizon so it is not
 * spun on while a local model works. Once the client has answered -- or given
 * up and reported a failure -- the after-response drain should pick it up
 * right away. This moves the job to now so that drain actually leases it.
 */
export async function wakeParkedJob(input: {
  jobId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [job] = await db
    .update(backgroundJobs)
    .set({
      availableAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(backgroundJobs.id, input.jobId),
        eq(backgroundJobs.state, "queued"),
      ),
    )
    .returning();
  return job ?? null;
}

export async function failJob(input: {
  jobId: string;
  workerId: string;
  errorCode: string;
  safeMessage: string;
  retryDelaySeconds?: number;
  retryable?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const current = await tx.query.backgroundJobs.findFirst({
      where: { RAW: (table, operators) => and(eq(table.id, input.jobId), eq(table.leaseOwner, input.workerId), eq(table.state, "running")) ?? operators.sql`true` },
    });
    if (!current) throw leaseLost();
    const retry = input.retryable !== false && current.attemptCount < current.maxAttempts;
    const [job] = await tx.update(backgroundJobs).set({
      state: retry ? "queued" : "failed",
      availableAt: retry ? new Date(now.getTime() + (input.retryDelaySeconds ?? 0) * 1000) : current.availableAt,
      errorCode: input.errorCode,
      errorMessage: input.safeMessage,
      leaseOwner: null,
      leaseExpiresAt: null,
      finishedAt: retry ? null : now,
      updatedAt: now,
    }).where(eq(backgroundJobs.id, current.id)).returning();
    if (!retry) {
      await tx.update(aiProcessingRuns).set({
        status: "failed",
        failureCode: "GENERATION_JOB_FAILED",
        failureMessage: "The generation job ended before publication.",
        completedAt: now,
      }).where(and(
        eq(aiProcessingRuns.jobId, current.id),
        eq(aiProcessingRuns.status, "processing"),
      ));
    }
    return job!;
  });
}

export function monitorJobCancellation(jobId: string, intervalMs = 1_000) {
  const controller = new AbortController();
  const timer = setInterval(async () => {
    const job = await db.query.backgroundJobs.findFirst({
      columns: { cancellationRequestedAt: true },
      where: { RAW: (table, operators) => eq(table.id, jobId) ?? operators.sql`true` },
    });
    if (job?.cancellationRequestedAt) controller.abort(new Error("Job cancellation requested"));
  }, intervalMs);
  return { signal: controller.signal, stop: () => clearInterval(timer) };
}

export async function requestJobCancellation(userId: string, jobId: string) {
  const job = await db.query.backgroundJobs.findFirst({
    where: { RAW: (table, operators) => eq(table.id, jobId) ?? operators.sql`true` },
  });
  if (!job?.organizationId) throw new ApiError(404, "Job not found");
  const definition = getJobDefinition(job.kind);
  if (!definition.cancellable || !definition.cancellationCapability) {
    if (!definition.readCapability) {
      throw new ApiError(404, "Job not found", undefined, "JOB_NOT_FOUND");
    }
    await authorizeOrganizationRead({
      actorUserId: userId,
      organizationId: job.organizationId,
      capability: definition.readCapability,
    });
    throw new ApiError(409, "The job cannot be cancelled", undefined, "JOB_NOT_CANCELLABLE");
  }
  return withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId: job.organizationId, capability: definition.cancellationCapability }, async ({ executor }) => {
    const current = await executor.query.backgroundJobs.findFirst({ where: { RAW: (table, operators) => and(eq(table.id, jobId), eq(table.organizationId, job.organizationId!)) ?? operators.sql`true` } });
    if (!current) throw new ApiError(404, "Job not found", undefined, "JOB_NOT_FOUND");
    if (!["queued", "leased", "running"].includes(current.state)) return toJobDto(current);
    const now = new Date();
    const rows = await executor.update(backgroundJobs).set({
      cancellationRequestedAt: now,
      state: current.state === "queued" ? "cancelled" : current.state,
      finishedAt: current.state === "queued" ? now : null,
      updatedAt: now,
    }).where(and(eq(backgroundJobs.id, current.id), eq(backgroundJobs.organizationId, job.organizationId!))).returning();
    if (current.state === "queued") {
      await executor.update(aiProcessingRuns).set({
        status: "failed",
        failureCode: "GENERATION_JOB_CANCELLED",
        failureMessage: "The generation job was cancelled before publication.",
        completedAt: now,
      }).where(and(
        eq(aiProcessingRuns.jobId, current.id),
        eq(aiProcessingRuns.organizationId, job.organizationId!),
        eq(aiProcessingRuns.status, "processing"),
      ));
    }
    return toJobDto(rows[0]!);
  });
}

export async function finalizeJobCancellation(jobId: string, workerId: string) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [job] = await tx.update(backgroundJobs).set({
      state: "cancelled",
      leaseOwner: null,
      leaseExpiresAt: null,
      finishedAt: now,
      updatedAt: now,
    }).where(and(eq(backgroundJobs.id, jobId), eq(backgroundJobs.leaseOwner, workerId))).returning();
    if (!job) throw leaseLost();
    await tx.update(aiProcessingRuns).set({
      status: "failed",
      failureCode: "GENERATION_JOB_CANCELLED",
      failureMessage: "The generation job was cancelled before publication.",
      completedAt: now,
    }).where(and(
      eq(aiProcessingRuns.jobId, job.id),
      eq(aiProcessingRuns.status, "processing"),
    ));
    return job;
  });
}

export function toJobDto(job: BackgroundJobRecord): JobDto {
  const total = job.progressTotal;
  const progress = total && job.progressCurrent !== null ? Math.round(job.progressCurrent / total * 100) : job.state === "succeeded" ? 100 : 0;
  const projection = projectJobResult(job);
  return {
    id: job.id,
    kind: job.kind,
    state: job.cancellationRequestedAt && !["succeeded", "failed", "cancelled"].includes(job.state)
      ? "cancellation_requested"
      : job.state === "leased" ? "running" : job.state,
    progress,
    phase: isProgressPhase(job.progressMessage) ? job.progressMessage : null,
    waitingOnClient: job.progressMessage === "awaiting_client_inference",
    completedUnits: job.progressCurrent,
    totalUnits: job.progressTotal,
    attemptCount: job.attemptCount,
    safeError: job.state === "failed" && job.errorCode ? { code: job.errorCode, message: job.errorMessage ?? "Job failed" } : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    cancellable: getJobDefinition(job.kind).cancellable && !["succeeded", "failed", "cancelled"].includes(job.state),
    ...projection,
  };
}

function isProgressPhase(value: string | null): value is JobProgressPhase {
  return value !== null && ["preparing_evidence", "generating_categories", "validating", "saving_result", "completed"].includes(value);
}

function leaseLost() {
  return new ApiError(409, "The job lease is no longer held", undefined, "JOB_LEASE_LOST");
}
