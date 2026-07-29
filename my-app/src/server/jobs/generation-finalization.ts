import { db } from "@/src/db";
import {
  aiProcessingRuns,
  auditEvents,
  backgroundJobs,
  gapReassessmentDrafts,
} from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  isActionPlanGenerationJobKind,
  isGapGenerationJobKind,
} from "./generation-kinds";
import { nextFailureState } from "./state-machine";
import { emitGenerationMetric } from "../ai/generation/metrics";

export async function finalizeGenerationJobFailure(input: {
  jobId: string;
  workerId: string;
  errorCode: string;
  safeMessage: string;
  retryable: boolean;
  retryDelaySeconds?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: backgroundJobs.id,
          organizationId: backgroundJobs.organizationId,
          requestedByUserId: backgroundJobs.requestedByUserId,
          kind: backgroundJobs.kind,
          attemptCount: backgroundJobs.attemptCount,
          maxAttempts: backgroundJobs.maxAttempts,
          runAfter: backgroundJobs.runAfter,
        })
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.id, input.jobId),
            eq(backgroundJobs.leaseOwner, input.workerId),
            eq(backgroundJobs.state, "running"),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) throw generationLeaseLost();
      assertGenerationKind(current.kind);
      const state = input.retryable
        ? nextFailureState(current.attemptCount, current.maxAttempts)
        : ("failed" as const);
      const [job] = await tx
        .update(backgroundJobs)
        .set({
          state,
          safeErrorCode: input.errorCode,
          safeErrorMessage: input.safeMessage,
          leaseOwner: null,
          leaseExpiresAt: null,
          runAfter:
            state === "queued"
              ? new Date(
                  now.getTime() + (input.retryDelaySeconds ?? 30) * 1_000,
                )
              : current.runAfter,
          finishedAt: state === "failed" ? now : null,
          updatedAt: now,
        })
        .where(eq(backgroundJobs.id, current.id))
        .returning();
      if (!job) throw generationLeaseLost();
      if (state === "queued") return job;

      await tx
        .update(aiProcessingRuns)
        .set({
          status: "failed",
          errorCode: input.errorCode,
          errorMessage: input.safeMessage,
          completedAt: now,
        })
        .where(
          and(
            eq(aiProcessingRuns.jobId, current.id),
            eq(aiProcessingRuns.status, "processing"),
          ),
        );
      if (isGapGenerationJobKind(current.kind)) {
        await tx
          .update(gapReassessmentDrafts)
          .set({ status: "failed", completedAt: now, updatedAt: now })
          .where(eq(gapReassessmentDrafts.generationJobId, current.id));
      }
      if (current.organizationId) {
        await tx.insert(auditEvents).values({
          organizationId: current.organizationId,
          actorUserId: current.requestedByUserId,
          eventType: isGapGenerationJobKind(current.kind)
            ? "gap_reassessment.failed"
            : "action_plan.generation_failed",
          entityType: "background_job",
          entityId: current.id,
          metadata: { errorCode: input.errorCode, atomic: true },
        });
      }
      return job;
    });
  } catch (error) {
    emitGenerationMetric({
      name: "atomic_finalization_failure",
      value: 1,
      jobId: input.jobId,
      safeCode: input.errorCode,
    });
    throw error;
  }
}

export async function finalizeGenerationJobCancellation(input: {
  jobId: string;
  workerId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: backgroundJobs.id,
          organizationId: backgroundJobs.organizationId,
          requestedByUserId: backgroundJobs.requestedByUserId,
          kind: backgroundJobs.kind,
        })
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.id, input.jobId),
            eq(backgroundJobs.leaseOwner, input.workerId),
            eq(backgroundJobs.state, "cancellation_requested"),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) throw generationLeaseLost();
      assertGenerationKind(current.kind);
      const [job] = await tx
        .update(backgroundJobs)
        .set({
          state: "cancelled",
          leaseOwner: null,
          leaseExpiresAt: null,
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(backgroundJobs.id, current.id))
        .returning();
      if (!job) throw generationLeaseLost();
      await tx
        .update(aiProcessingRuns)
        .set({
          status: "failed",
          errorCode: "GENERATION_CANCELLED",
          errorMessage: "The background operation was cancelled.",
          completedAt: now,
        })
        .where(
          and(
            eq(aiProcessingRuns.jobId, current.id),
            eq(aiProcessingRuns.status, "processing"),
          ),
        );
      if (isGapGenerationJobKind(current.kind)) {
        await tx
          .update(gapReassessmentDrafts)
          .set({ status: "cancelled", completedAt: now, updatedAt: now })
          .where(eq(gapReassessmentDrafts.generationJobId, current.id));
      }
      if (current.organizationId) {
        await tx.insert(auditEvents).values({
          organizationId: current.organizationId,
          actorUserId: current.requestedByUserId,
          eventType: isGapGenerationJobKind(current.kind)
            ? "gap_reassessment.cancelled"
            : "action_plan.generation_cancelled",
          entityType: "background_job",
          entityId: current.id,
          metadata: { errorCode: "GENERATION_CANCELLED", atomic: true },
        });
      }
      return job;
    });
  } catch (error) {
    emitGenerationMetric({
      name: "atomic_finalization_failure",
      value: 1,
      jobId: input.jobId,
      safeCode: "GENERATION_CANCELLED",
    });
    throw error;
  }
}

function assertGenerationKind(kind: string) {
  if (!isGapGenerationJobKind(kind) && !isActionPlanGenerationJobKind(kind)) {
    throw new ApiError(
      409,
      "The job is not a generation job",
      undefined,
      "GENERATION_JOB_KIND_INVALID",
    );
  }
}

function generationLeaseLost() {
  return new ApiError(
    409,
    "The generation job lease is no longer held",
    undefined,
    "JOB_LEASE_LOST",
  );
}
