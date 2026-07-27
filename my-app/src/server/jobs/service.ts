import { db } from "@/src/db";
import { aiProcessingRuns, auditEvents, backgroundJobResults, backgroundJobs, gapReassessmentDrafts, reports } from "@/src/db/schema";
import type { JobDto } from "@/src/contracts/common/jobs";
import { requireOrganizationCapability, requirePlatformCapability } from "@/src/server/auth/capability-service";
import { organizationCapabilities, type OrganizationCapability } from "@/src/server/auth/capabilities";
import { and, asc, eq, inArray, isNotNull, lte, or } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { cancellationTransition, nextFailureState } from "./state-machine";
import {
  isActionPlanGenerationJobKind,
  isGapGenerationJobKind,
} from "./generation-kinds";

export type EnqueueJobInput = {
  kind: string;
  payload: Record<string, unknown>;
  organizationId?: string;
  requestedByUserId?: string;
  maxAttempts?: number;
  cancellable?: boolean;
  cancellationCapability?: OrganizationCapability;
  runAfter?: Date;
};

export type BackgroundJobRecord = typeof backgroundJobs.$inferSelect;

export async function enqueueJob(input: EnqueueJobInput) {
  if (input.organizationId && (input.cancellable ?? true) && !input.cancellationCapability) {
    throw new ApiError(500, "Organization jobs require a cancellation capability", undefined, "JOB_POLICY_INVALID");
  }
  const [job] = await db
    .insert(backgroundJobs)
    .values({
      kind: input.kind,
      payload: input.payload,
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      maxAttempts: input.maxAttempts ?? 3,
      cancellable: input.cancellable ?? true,
      cancellationCapability: input.cancellationCapability,
      runAfter: input.runAfter,
    })
    .returning();
  return job;
}

export async function getAuthorizedJob(userId: string, jobId: string) {
  const job = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true },
    where: { RAW: (table, operators) => (eq(table.id, jobId)) ?? operators.sql`true` },
  });
  if (!job) throw new ApiError(404, "Job not found", undefined, "JOB_NOT_FOUND");

  if (job.organizationId) {
    await requireOrganizationCapability(userId, job.organizationId, "organizations:read");
  } else {
    await requirePlatformCapability(userId, "corpus:read");
  }
  const result =
    job.state === "succeeded"
      ? await db.query.backgroundJobResults.findFirst({
          columns: { actionPlanId: true },
          where: {
            RAW: (table, operators) =>
              eq(table.jobId, job.id) ?? operators.sql`true`,
          },
        })
      : null;
  return toJobDto(
    job,
    result?.actionPlanId
      ? { actionPlanId: result.actionPlanId }
      : null,
  );
}

export async function leaseNextJob(input: {
  workerId: string;
  kinds: string[];
  leaseSeconds: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + input.leaseSeconds * 1000);

  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({
        id: backgroundJobs.id,
        state: backgroundJobs.state,
        attemptCount: backgroundJobs.attemptCount,
        maxAttempts: backgroundJobs.maxAttempts,
        startedAt: backgroundJobs.startedAt,
      })
      .from(backgroundJobs)
      .where(
        and(
          inArray(backgroundJobs.kind, input.kinds),
          or(
            and(eq(backgroundJobs.state, "queued"), lte(backgroundJobs.runAfter, now)),
            and(
              inArray(backgroundJobs.state, ["running", "cancellation_requested"]),
              isNotNull(backgroundJobs.leaseExpiresAt),
              lte(backgroundJobs.leaseExpiresAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(backgroundJobs.runAfter), asc(backgroundJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!candidate) return null;
    if (candidate.attemptCount >= candidate.maxAttempts) {
      await tx
        .update(backgroundJobs)
        .set({
          state: "failed",
          safeErrorCode: "JOB_ATTEMPTS_EXHAUSTED",
          safeErrorMessage: "The job exhausted its retry limit.",
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(backgroundJobs.id, candidate.id));
      return null;
    }

    const [leased] = await tx
      .update(backgroundJobs)
      .set({
        state: candidate.state === "cancellation_requested" ? "cancellation_requested" : "running",
        attemptCount: candidate.state === "cancellation_requested" ? candidate.attemptCount : candidate.attemptCount + 1,
        leaseOwner: input.workerId,
        leaseExpiresAt,
        heartbeatAt: now,
        startedAt: candidate.startedAt ?? now,
        updatedAt: now,
      })
      .where(eq(backgroundJobs.id, candidate.id))
      .returning();
    return leased;
  });
}

export async function heartbeatJob(input: {
  jobId: string;
  workerId: string;
  progress: number;
  leaseSeconds: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [job] = await db
    .update(backgroundJobs)
    .set({
      progress: Math.max(0, Math.min(100, Math.trunc(input.progress))),
      heartbeatAt: now,
      leaseExpiresAt: new Date(now.getTime() + input.leaseSeconds * 1000),
      updatedAt: now,
    })
    .where(
      and(
        eq(backgroundJobs.id, input.jobId),
        eq(backgroundJobs.leaseOwner, input.workerId),
        eq(backgroundJobs.state, "running"),
      ),
    )
    .returning();
  if (!job) {
    const cancellation = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.id, input.jobId),
        eq(table.leaseOwner, input.workerId),
        eq(table.state, "cancellation_requested"),
      )) ?? operators.sql`true` },
    });
    if (cancellation) return cancellation;
    const completed = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.id, input.jobId),
        eq(table.state, "succeeded"),
      )) ?? operators.sql`true` },
    });
    if (completed) return completed;
    throw leaseLost();
  }
  return job;
}

export async function succeedJob(input: {
  jobId: string;
  workerId: string;
  result?: { type: string; id: string };
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const resultValues = input.result ? toJobResultValues(input.jobId, input.result) : null;
  return db.transaction(async (tx) => {
    const [job] = await tx
      .update(backgroundJobs)
      .set({
        state: "succeeded",
        progress: 100,
        safeErrorCode: null,
        safeErrorMessage: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        finishedAt: now,
        updatedAt: now,
      })
      .where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.leaseOwner, input.workerId), eq(backgroundJobs.state, "running")))
      .returning();
    if (!job) throw leaseLost();
    if (resultValues) await tx.insert(backgroundJobResults).values(resultValues);
    return job;
  });
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
    const [current] = await tx
      .select({
        id: backgroundJobs.id,
        attemptCount: backgroundJobs.attemptCount,
        maxAttempts: backgroundJobs.maxAttempts,
        runAfter: backgroundJobs.runAfter,
      })
      .from(backgroundJobs)
      .where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.leaseOwner, input.workerId), eq(backgroundJobs.state, "running")))
      .limit(1)
      .for("update");
    if (!current) throw leaseLost();
    const state =
      input.retryable === false
        ? ("failed" as const)
        : nextFailureState(current.attemptCount, current.maxAttempts);
    const [job] = await tx
      .update(backgroundJobs)
      .set({
        state,
        safeErrorCode: input.errorCode,
        safeErrorMessage: input.safeMessage,
        leaseOwner: null,
        leaseExpiresAt: null,
        runAfter: state === "queued"
          ? new Date(now.getTime() + (input.retryDelaySeconds ?? 30) * 1000)
          : current.runAfter,
        finishedAt: state === "failed" ? now : null,
        updatedAt: now,
      })
      .where(eq(backgroundJobs.id, current.id))
      .returning();
    return job;
  });
}

export function monitorJobCancellation(jobId: string, intervalMs = 1_000) {
  const controller = new AbortController();
  let stopped = false;
  let checking = false;
  const check = async () => {
    if (stopped || checking || controller.signal.aborted) return;
    checking = true;
    try {
      const job = await db.query.backgroundJobs.findFirst({
        columns: { state: true },
        where: {
          RAW: (table, operators) =>
            eq(table.id, jobId) ?? operators.sql`true`,
        },
      });
      if (
        !job ||
        job.state === "cancellation_requested" ||
        job.state === "cancelled"
      ) {
        controller.abort("job_cancellation_requested");
      }
    } finally {
      checking = false;
    }
  };
  const timer = setInterval(() => void check(), Math.max(250, intervalMs));
  return {
    signal: controller.signal,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export async function requestJobCancellation(userId: string, jobId: string) {
  const current = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, jobId)) ?? operators.sql`true` } });
  if (!current) throw new ApiError(404, "Job not found", undefined, "JOB_NOT_FOUND");
  if (current.organizationId) {
    if (!current.cancellationCapability || !isOrganizationCapability(current.cancellationCapability)) {
      throw new ApiError(409, "The job has no valid cancellation policy", undefined, "JOB_POLICY_INVALID");
    }
    await requireOrganizationCapability(userId, current.organizationId, current.cancellationCapability);
  } else {
    await requirePlatformCapability(userId, "corpus:operate");
  }
  if (current.kind === "report-render") {
    const report = await db.query.reports.findFirst({ columns: { id: true, organizationId: true, kind: true, locale: true, state: true, inputSnapshot: true, inputHash: true, jobId: true, storageBucket: true, storagePath: true, outputHash: true, fileSize: true, safeErrorCode: true, createdBy: true, createdAt: true, updatedAt: true, completedAt: true }, where: { RAW: (table, operators) => (eq(table.jobId, current.id)) ?? operators.sql`true` } });
    if (report?.state === "ready") {
      throw new ApiError(409, "The report is already ready", undefined, "JOB_NOT_CANCELLABLE");
    }
  }
  const state = cancellationTransition(current.state, current.cancellable);
  const now = new Date();
  const [job] = await db
    .update(backgroundJobs)
    .set({
      state,
      cancellationRequestedAt: now,
      finishedAt: state === "cancelled" ? now : null,
      updatedAt: now,
    })
    .where(and(eq(backgroundJobs.id, jobId), eq(backgroundJobs.state, current.state)))
    .returning();
  if (!job) throw new ApiError(409, "Job state changed", undefined, "JOB_STATE_CHANGED");
  if (isGapGenerationJobKind(job.kind)) {
    await db.update(aiProcessingRuns).set({ cancellationRequestedAt: now })
      .where(eq(aiProcessingRuns.jobId, job.id));
    if (job.state === "cancelled") {
      await db.update(gapReassessmentDrafts).set({ status: "cancelled", completedAt: now, updatedAt: now })
        .where(eq(gapReassessmentDrafts.generationJobId, job.id));
    }
    if (job.organizationId) await db.insert(auditEvents).values({
      organizationId: job.organizationId,
      actorUserId: userId,
      eventType: "gap_reassessment.generation_cancellation_requested",
      entityType: "background_job",
      entityId: job.id,
      metadata: { state: job.state },
    });
  }
  if (isActionPlanGenerationJobKind(job.kind)) {
    await db
      .update(aiProcessingRuns)
      .set({ cancellationRequestedAt: now })
      .where(eq(aiProcessingRuns.jobId, job.id));
    if (job.organizationId) {
      await db.insert(auditEvents).values({
        organizationId: job.organizationId,
        actorUserId: userId,
        eventType:
          "action_plan.generation_cancellation_requested",
        entityType: "background_job",
        entityId: job.id,
        metadata: { state: job.state },
      });
    }
  }
  if (job.kind === "report-render") {
    await db.update(reports).set({ state: "cancelled", completedAt: now, updatedAt: now })
      .where(eq(reports.jobId, job.id));
  }
  return toJobDto(job);
}

export async function finalizeJobCancellation(jobId: string, workerId: string) {
  const now = new Date();
  const [job] = await db
    .update(backgroundJobs)
    .set({ state: "cancelled", leaseOwner: null, leaseExpiresAt: null, finishedAt: now, updatedAt: now })
    .where(and(eq(backgroundJobs.id, jobId), eq(backgroundJobs.leaseOwner, workerId), eq(backgroundJobs.state, "cancellation_requested")))
    .returning();
  if (!job) throw leaseLost();
  return job;
}

export function toJobDto(
  job: typeof backgroundJobs.$inferSelect,
  result: { actionPlanId: string } | null = null,
): JobDto {
  return {
    id: job.id,
    kind: job.kind,
    state: job.state,
    progress: job.progress,
    attemptCount: job.attemptCount,
    safeError:
      job.state === "failed" && job.safeErrorCode && job.safeErrorMessage
      ? { code: job.safeErrorCode, message: job.safeErrorMessage }
      : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    cancellable: job.cancellable && !["succeeded", "failed", "cancelled"].includes(job.state),
    resultLink: null,
    result,
  };
}

function leaseLost() {
  return new ApiError(409, "The job lease is no longer held", undefined, "JOB_LEASE_LOST");
}

function isOrganizationCapability(value: string): value is OrganizationCapability {
  return (organizationCapabilities as readonly string[]).includes(value);
}

export function toJobResultValues(jobId: string, result: { type: string; id: string }) {
  switch (result.type) {
    case "generated_artifact_revision":
      return { jobId, generatedArtifactRevisionId: result.id };
    case "report":
      return { jobId, reportId: result.id };
    case "legal_source_rendition":
      return { jobId, legalSourceRenditionId: result.id };
    case "legal_processing_generation":
      return { jobId, legalProcessingGenerationId: result.id };
    case "legal_source_monitor":
      return { jobId, legalSourceMonitorId: result.id };
    case "legal_corpus_evaluation":
      return { jobId, legalCorpusEvaluationId: result.id };
    case "action_plan":
      return { jobId, actionPlanId: result.id };
    default:
      throw new ApiError(500, "Unsupported job result kind", undefined, "JOB_RESULT_KIND_INVALID");
  }
}
