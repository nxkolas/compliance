import {
  ACTION_PLAN_GENERATION_JOB_KINDS,
  GAP_GENERATION_JOB_KINDS,
  failJob,
  finalizeJobCancellation,
  finalizeGenerationJobCancellation,
  finalizeGenerationJobFailure,
  heartbeatJob,
  isActionPlanGenerationJobKind,
  isGapGenerationJobKind,
  leaseNextJob,
  monitorJobCancellation,
  recordWorkerDomainCancellation,
  recordWorkerDomainFailure,
  succeedJob,
  type BackgroundJobRecord,
} from "@/src/server/jobs";
import {
  classifyGenerationFailure,
  combineAbortSignals,
  isCancellationFailure,
} from "@/src/server/ai/generation";
import {
  ensureScheduledLegalSourceMonitorJobs,
  handleGroundingEvaluation,
  handleLegalSourceEmbed,
  handleLegalSourceImport,
  handleLegalSourceMonitor,
  handleLegalSourceProcess,
} from "@/src/server/corpus";
import { handleGapGeneration } from "@/src/worker/handlers/gap-generation";
import { handleActionPlanGeneration } from "@/src/worker/handlers/action-plan-generation";
import { handleReportRender } from "@/src/server/reports";
import { runMaintenanceCleanup, ensureScheduledCleanupJob } from "@/src/server/api/cleanup";
import { ApiError } from "@/src/server/api/errors";
import { createJobDrain } from "./drain";
import type { DrainJobsInput, JobExecutionCycleResult } from "./contracts";
import { throwIfJobExecutionAborted } from "./abort";

const LEASE_SECONDS = 60;
const HEARTBEAT_INTERVAL_MS = 20_000;

const PORTABLE_JOB_KINDS = [
  "legal-source-process",
  "legal-source-embed",
  "legal-source-monitor",
  "legal-source-import",
  "grounding-evaluation",
  ...GAP_GENERATION_JOB_KINDS,
  ...ACTION_PLAN_GENERATION_JOB_KINDS,
  "report-render",
  "cleanup",
] as const;

type PortableJobKind = (typeof PORTABLE_JOB_KINDS)[number];
type JobHandlerResult = { type: string; id: string } | undefined;
type JobHandler = (
  job: BackgroundJobRecord,
  signal: AbortSignal,
) => Promise<JobHandlerResult>;

const handlers = {
  "legal-source-process": async (job, signal) => {
    return handleLegalSourceProcess(job, {}, signal);
  },
  "legal-source-embed": async (job, signal) => {
    return handleLegalSourceEmbed(job, {}, signal);
  },
  "legal-source-monitor": async (job, signal) => {
    return handleLegalSourceMonitor(job, signal);
  },
  "legal-source-import": async (job, signal) => {
    return handleLegalSourceImport(job, signal);
  },
  "grounding-evaluation": async (job, signal) => {
    return handleGroundingEvaluation(job, signal);
  },
  "gap-generation": handleGapGeneration,
  "gap-generation-v8": handleGapGeneration,
  "gap-generation-v9": handleGapGeneration,
  "gap-generation-v10": handleGapGeneration,
  "gap-generation-v11": handleGapGeneration,
  "gap-generation-v12": handleGapGeneration,
  "action-plan-generation": handleActionPlanGeneration,
  "action-plan-generation-v2": handleActionPlanGeneration,
  "action-plan-generation-v3": handleActionPlanGeneration,
  "action-plan-generation-v4": handleActionPlanGeneration,
  "action-plan-generation-v5": handleActionPlanGeneration,
  "action-plan-generation-v6": handleActionPlanGeneration,
  "report-render": async (job, signal) => {
    return handleReportRender(job, signal);
  },
  cleanup: async (job, signal) => {
    throwIfJobExecutionAborted(signal);
    await runMaintenanceCleanup();
    void job;
    throwIfJobExecutionAborted(signal);
    return undefined;
  },
} satisfies Record<PortableJobKind, JobHandler>;

export const drainJobs = createJobDrain({
  now: Date.now,
  ensureSchedules: async () => {
    await Promise.all([
      ensureScheduledCleanupJob(),
      ensureScheduledLegalSourceMonitorJobs(),
    ]);
  },
  runOneCycle: executeOneJob,
});

export async function runOneJob(workerId: string) {
  const result = await executeOneJob({
    invocationId: workerId,
    signal: new AbortController().signal,
    deadlineSignal: new AbortController().signal,
  });
  return result.claimed;
}

async function executeOneJob(input: {
  invocationId: string;
  signal: AbortSignal;
  callerSignal?: AbortSignal;
  deadlineSignal: AbortSignal;
}): Promise<JobExecutionCycleResult> {
  throwIfJobExecutionAborted(input.signal);
  const job = await leaseNextJob({
    workerId: input.invocationId,
    kinds: [...PORTABLE_JOB_KINDS],
    leaseSeconds: LEASE_SECONDS,
  });
  if (!job) return { claimed: false };

  const startedAt = Date.now();
  let outcome: string = "running";
  let executionOutcome: JobExecutionCycleResult & { claimed: true } = {
    claimed: true,
    outcome: "failed",
  };
  console.info("Worker job started", {
    jobId: job.id,
    kind: job.kind,
    attempt: job.attemptCount,
    invocationId: input.invocationId,
  });
  const heartbeat = setInterval(() => {
    void heartbeatJob({
      jobId: job.id,
      workerId: input.invocationId,
      progress: job.progress,
      leaseSeconds: LEASE_SECONDS,
    }).catch((error) =>
      console.error("Worker heartbeat failed", {
        jobId: job.id,
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
  }, HEARTBEAT_INTERVAL_MS);
  const cancellationMonitor = monitorJobCancellation(job.id);
  const handlerSignal = combineAbortSignals([
    cancellationMonitor.signal,
    input.signal,
  ]);

  try {
    if (job.state === "cancellation_requested") {
      await finalizeCancellation(job, input.invocationId);
      outcome = "cancelled";
      executionOutcome = { claimed: true, outcome: "cancelled" };
      return executionOutcome;
    }

    if (!isPortableJobKind(job.kind)) {
      throw new Error(`No worker handler for ${job.kind}`);
    }
    const result = await handlers[job.kind](job, handlerSignal);
    const current = await heartbeatJob({
      jobId: job.id,
      workerId: input.invocationId,
      progress: 100,
      leaseSeconds: LEASE_SECONDS,
    });
    if (current.state === "succeeded") {
      outcome = "succeeded";
    } else if (current.state === "cancellation_requested") {
      await finalizeCancellation(job, input.invocationId);
      outcome = "cancelled";
      executionOutcome = { claimed: true, outcome: "cancelled" };
      return executionOutcome;
    } else {
      await succeedJob({
        jobId: job.id,
        workerId: input.invocationId,
        result,
      });
      outcome = "succeeded";
    }
    executionOutcome = { claimed: true, outcome: "succeeded" };
  } catch (error) {
    logDiagnostic(job, error);
    if (cancellationMonitor.signal.aborted) {
      await finalizeCancellation(job, input.invocationId);
      outcome = "cancelled";
      executionOutcome = { claimed: true, outcome: "cancelled" };
      return executionOutcome;
    }

    const executionInterruption = input.deadlineSignal.aborted
      ? { code: "JOB_EXECUTION_DEADLINE", retryable: true }
      : input.callerSignal?.aborted
        ? { code: "JOB_EXECUTION_ABORTED", retryable: true }
        : null;
    if (!executionInterruption && isCancellationFailure(error)) {
      await finalizeCancellation(job, input.invocationId);
      outcome = "cancelled";
      executionOutcome = { claimed: true, outcome: "cancelled" };
      return executionOutcome;
    }

    const generationFailure =
      !executionInterruption &&
      (isGapGenerationJobKind(job.kind) ||
        isActionPlanGenerationJobKind(job.kind))
        ? classifyGenerationFailure(error)
        : null;
    const errorCode =
      executionInterruption?.code ??
      generationFailure?.safeCode ??
      (error instanceof Error && error.name === "AbortError"
        ? "JOB_TIMEOUT"
        : error instanceof ApiError
          ? error.code
          : "JOB_FAILED");
    const failed =
      isGapGenerationJobKind(job.kind) ||
      isActionPlanGenerationJobKind(job.kind)
        ? await finalizeGenerationJobFailure({
            jobId: job.id,
            workerId: input.invocationId,
            errorCode,
            safeMessage: "The background operation failed.",
            retryable:
              executionInterruption?.retryable ??
              generationFailure?.failureClass === "transient_provider",
            retryDelaySeconds:
              generationFailure?.failureClass === "transient_provider"
                ? Math.ceil((generationFailure.retryAfterMs ?? 1_000) / 1_000)
                : undefined,
          })
        : await failJob({
            jobId: job.id,
            workerId: input.invocationId,
            errorCode,
            safeMessage: "The background operation failed.",
            retryable: executionInterruption?.retryable ?? true,
          });
    if (failed.state === "failed" && generationFailure === null) {
      await recordWorkerDomainFailure(job, errorCode);
    }
    outcome = failed.state;
    executionOutcome = {
      claimed: true,
      outcome: failed.state === "queued" ? "retried" : "failed",
    };
  } finally {
    clearInterval(heartbeat);
    cancellationMonitor.stop();
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
      invocationId: input.invocationId,
    });
  }
  return executionOutcome;
}

async function finalizeCancellation(job: BackgroundJobRecord, workerId: string) {
  if (
    isGapGenerationJobKind(job.kind) ||
    isActionPlanGenerationJobKind(job.kind)
  ) {
    await finalizeGenerationJobCancellation({ jobId: job.id, workerId });
  } else {
    await finalizeJobCancellation(job.id, workerId);
    await recordWorkerDomainCancellation(job);
  }
}

function isPortableJobKind(kind: string): kind is PortableJobKind {
  return (PORTABLE_JOB_KINDS as readonly string[]).includes(kind);
}

function logDiagnostic(job: BackgroundJobRecord, error: unknown) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.WORKER_DEBUG_ERRORS !== "1"
  ) {
    return;
  }
  console.error("Worker job diagnostic", {
    jobId: job.id,
    kind: job.kind,
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error &&
    "cause" in error &&
    error.cause instanceof Error
      ? { causeName: error.cause.name, causeMessage: error.cause.message }
      : {}),
    ...(error instanceof ApiError ? { details: error.details } : {}),
  });
}

export async function drainPortableJobs(input: DrainJobsInput) {
  const startedAt = Date.now();
  const result = await drainJobs(input);
  console.info("Job drain completed", {
    ...result,
    durationMs: Date.now() - startedAt,
  });
  return result;
}
