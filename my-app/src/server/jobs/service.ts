import type { JobDto, JobProgressPhase } from "@/src/contracts/common/jobs";
import { db } from "@/src/db";
import { aiProcessingRuns, backgroundJobs } from "@/src/db/schema";
import type { OrganizationCapability } from "../auth/capabilities";
import { requireOrganizationCapability } from "../auth/capability-service";
import { ApiError } from "../api/errors";
import { and, asc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";

export type EnqueueJobInput = {
  kind: typeof backgroundJobs.$inferInsert["kind"];
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
  const [job] = await db.insert(backgroundJobs).values({
    kind: input.kind,
    payload: input.payload,
    organizationId: input.organizationId,
    requestedBy: input.requestedByUserId,
    maxAttempts: input.maxAttempts ?? 3,
    availableAt: input.runAfter ?? new Date(),
  }).returning();
  if (!job) throw new Error("Job was not created");
  return job;
}

export async function getAuthorizedJob(userId: string, jobId: string) {
  const job = await db.query.backgroundJobs.findFirst({
    where: { RAW: (table, operators) => eq(table.id, jobId) ?? operators.sql`true` },
  });
  if (!job?.organizationId) throw new ApiError(404, "Job not found", undefined, "JOB_NOT_FOUND");
  await requireOrganizationCapability(userId, job.organizationId, capabilityForJob(job.kind));
  return toJobDto(job);
}

export async function leaseNextJob(input: {
  workerId: string;
  kinds: string[];
  leaseSeconds: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + input.leaseSeconds * 1000);
  return db.transaction(async (tx) => {
    const [candidate] = await tx.select().from(backgroundJobs).where(and(
      inArray(backgroundJobs.kind, input.kinds as Array<typeof backgroundJobs.$inferSelect.kind>),
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

export async function succeedJob(input: { jobId: string; workerId: string; result?: { type: string; id: string }; now?: Date }) {
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
  await requireOrganizationCapability(userId, job.organizationId, cancellationCapabilityForJob(job.kind));
  if (!["queued", "leased", "running"].includes(job.state)) return toJobDto(job);
  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx.update(backgroundJobs).set({
      cancellationRequestedAt: now,
      state: job.state === "queued" ? "cancelled" : job.state,
      finishedAt: job.state === "queued" ? now : null,
      updatedAt: now,
    }).where(eq(backgroundJobs.id, job.id)).returning();
    if (job.state === "queued") {
      await tx.update(aiProcessingRuns).set({
        status: "failed",
        failureCode: "GENERATION_JOB_CANCELLED",
        failureMessage: "The generation job was cancelled before publication.",
        completedAt: now,
      }).where(and(
        eq(aiProcessingRuns.jobId, job.id),
        eq(aiProcessingRuns.status, "processing"),
      ));
    }
    return rows;
  });
  return toJobDto(updated!);
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
  const locator = parseLocator(job.resultLocator);
  return {
    id: job.id,
    kind: job.kind,
    state: job.cancellationRequestedAt && !["succeeded", "failed", "cancelled"].includes(job.state)
      ? "cancellation_requested"
      : job.state === "leased" ? "running" : job.state,
    progress,
    phase: isProgressPhase(job.progressMessage) ? job.progressMessage : null,
    completedUnits: job.progressCurrent,
    totalUnits: job.progressTotal,
    attemptCount: job.attemptCount,
    safeError: job.state === "failed" && job.errorCode ? { code: job.errorCode, message: job.errorMessage ?? "Job failed" } : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    cancellable: isCancellableKind(job.kind) && !["succeeded", "failed", "cancelled"].includes(job.state),
    resultLink: locator?.type === "analysis_output_revision" && job.organizationId ? `/api/organizations/${job.organizationId}/gap-analysis/revisions/${locator.id}` : null,
    result: locator?.type === "action_plan" ? { actionPlanId: locator.id } : null,
  };
}

export function toJobResultValues(_jobId: string, result: { type: string; id: string }) {
  return result;
}

function capabilityForJob(kind: BackgroundJobRecord["kind"]): OrganizationCapability {
  if (kind === "document_indexing") return "documents:read";
  if (kind === "report_render") return "reports:read";
  if (kind === "action_plan_generation") return "plans:read";
  return "gap:read";
}

function cancellationCapabilityForJob(
  kind: BackgroundJobRecord["kind"],
): OrganizationCapability {
  if (kind === "document_indexing") return "documents:write";
  if (kind === "report_render") return "reports:create";
  if (kind === "action_plan_generation") return "plans:manage";
  return "gap:contribute";
}

function isCancellableKind(kind: BackgroundJobRecord["kind"]) {
  return ["gap_analysis", "gap_conflict_resolution", "action_plan_generation", "report_render", "document_indexing"].includes(kind);
}

function parseLocator(value: unknown): { type: string; id: string } | null {
  if (!value || typeof value !== "object") return null;
  const locator = value as { type?: unknown; id?: unknown };
  return typeof locator.type === "string" && typeof locator.id === "string" ? { type: locator.type, id: locator.id } : null;
}

function isProgressPhase(value: string | null): value is JobProgressPhase {
  return value !== null && ["preparing_evidence", "generating_categories", "validating", "saving_result", "completed"].includes(value);
}

function leaseLost() {
  return new ApiError(409, "The job lease is no longer held", undefined, "JOB_LEASE_LOST");
}
