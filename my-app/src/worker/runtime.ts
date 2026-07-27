import {
  failJob,
  finalizeJobCancellation,
  heartbeatJob,
  leaseNextJob,
  recordWorkerDomainCancellation,
  recordWorkerDomainFailure,
  succeedJob,
} from "@/src/server/jobs";
import { handleLegalSourceEmbed } from "./handlers/legal-source-embed";
import { handleLegalSourceProcess } from "./handlers/legal-source-process";
import { handleLegalSourceMonitor } from "./handlers/legal-source-monitor";
import { handleLegalSourceImport } from "./handlers/legal-source-import";
import { handleGroundingEvaluation } from "./handlers/grounding-evaluation";
import { handleGapGeneration } from "./handlers/gap-generation";
import { handleReportRender } from "./handlers/report-render";
import { handleCleanup } from "./handlers/cleanup";
import { handleActionPlanGeneration } from "./handlers/action-plan-generation";
import { ensureScheduledCleanupJob } from "@/src/server/api/cleanup";
import { ApiError } from "@/src/server/api/errors";
import { ensureScheduledLegalSourceMonitorJobs } from "@/src/server/corpus";

const handlers = {
  "legal-source-process": handleLegalSourceProcess,
  "legal-source-embed": handleLegalSourceEmbed,
  "legal-source-monitor": handleLegalSourceMonitor,
  "legal-source-import": handleLegalSourceImport,
  "grounding-evaluation": handleGroundingEvaluation,
  "gap-generation": handleGapGeneration,
  "action-plan-generation": handleActionPlanGeneration,
  "report-render": handleReportRender,
  cleanup: handleCleanup,
} as const;

export async function runOneJob(workerId: string) {
  const job = await leaseNextJob({
    workerId,
    kinds: Object.keys(handlers),
    leaseSeconds: 60,
  });
  if (!job) return false;
  const startedAt = Date.now();
  let outcome = "running";
  console.info("Worker job started", {
    jobId: job.id,
    kind: job.kind,
    attempt: job.attemptCount,
  });
  const heartbeat = setInterval(() => {
    void heartbeatJob({
      jobId: job.id,
      workerId,
      progress: job.progress,
      leaseSeconds: 60,
    }).catch((error) =>
      console.error("Worker heartbeat failed", {
        jobId: job.id,
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
  }, 20_000);
  try {
    if (job.state === "cancellation_requested") {
      await finalizeJobCancellation(job.id, workerId);
      await recordWorkerDomainCancellation(job);
      outcome = "cancelled";
      return true;
    }
    const handler = handlers[job.kind as keyof typeof handlers];
    if (!handler) throw new Error(`No worker handler for ${job.kind}`);
    const result = await handler(job);
    const current = await heartbeatJob({
      jobId: job.id,
      workerId,
      progress: 100,
      leaseSeconds: 60,
    });
    if (current.state === "succeeded") {
      outcome = "succeeded";
    } else if (current.state === "cancellation_requested") {
      await finalizeJobCancellation(job.id, workerId);
      await recordWorkerDomainCancellation(job);
      outcome = "cancelled";
    } else {
      await succeedJob({ jobId: job.id, workerId, result });
      outcome = "succeeded";
    }
  } catch (error) {
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.WORKER_DEBUG_ERRORS === "1"
    ) {
      console.error("Worker job diagnostic", {
        jobId: job.id,
        kind: job.kind,
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        ...(error instanceof Error &&
        "cause" in error &&
        error.cause instanceof Error
          ? {
              causeName: error.cause.name,
              causeMessage: error.cause.message,
            }
          : {}),
        ...(error instanceof ApiError ? { details: error.details } : {}),
      });
    }
    if (error instanceof Error && error.name === "JobCancellationError") {
      await finalizeJobCancellation(job.id, workerId);
      await recordWorkerDomainCancellation(job);
      outcome = "cancelled";
      return true;
    }
    const errorCode =
      error instanceof Error && error.name === "AbortError"
        ? "JOB_TIMEOUT"
        : error instanceof ApiError
          ? error.code
          : "JOB_FAILED";
    const failed = await failJob({
      jobId: job.id,
      workerId,
      errorCode,
      safeMessage: "The background operation failed.",
    });
    if (failed.state === "failed")
      await recordWorkerDomainFailure(job, errorCode);
    outcome = failed.state;
  } finally {
    clearInterval(heartbeat);
    if (job.kind === "cleanup" && outcome === "succeeded") {
      await ensureScheduledCleanupJob().catch((error) =>
        console.error("Could not schedule the next cleanup job", {
          errorType: error instanceof Error ? error.name : "unknown",
        }),
      );
    }
    if (
      job.kind === "legal-source-monitor" &&
      ["succeeded", "failed", "cancelled"].includes(outcome)
    ) {
      await ensureScheduledLegalSourceMonitorJobs().catch((error) =>
        console.error("Could not schedule legal-source monitor jobs", {
          errorType: error instanceof Error ? error.name : "unknown",
        }),
      );
    }
    console.info("Worker job finished", {
      jobId: job.id,
      kind: job.kind,
      outcome,
      durationMs: Date.now() - startedAt,
      attempt: job.attemptCount,
    });
  }
  return true;
}
