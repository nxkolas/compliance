import { executeDocumentIndexingJob } from "@/src/server/documents/service";
import { ensureScheduledCleanupJob, runMaintenanceCleanup } from "@/src/server/api/cleanup";
import {
  executeGapContradictionResolutionJob,
  executeGapGenerationJob,
} from "@/src/server/gap-analysis";
import {
  failJob,
  finalizeJobCancellation,
  leaseNextJob,
  monitorJobCancellation,
  succeedJob,
  type BackgroundJobRecord,
} from "@/src/server/jobs";
import { handleActionPlanGeneration } from "@/src/worker/handlers/action-plan-generation";
import { handleReportRender } from "@/src/server/reports";
import { executeLegalSourceProcessingJob } from "@/src/server/corpus";
import { createJobDrain } from "./drain";
import type { DrainJobsInput, JobExecutionCycleResult } from "./contracts";

const LEASE_SECONDS = 60;
const PORTABLE_JOB_KINDS: BackgroundJobRecord["kind"][] = [
  "gap_analysis",
  "gap_conflict_resolution",
  "action_plan_generation",
  "report_render",
  "document_indexing",
  "legal_source_processing",
  "maintenance_cleanup",
];

export const drainJobs = createJobDrain({
  now: Date.now,
  ensureSchedules: async () => { await ensureScheduledCleanupJob(); },
  runOneCycle: executeOneJob,
});

export async function runOneJob(workerId: string) {
  return (await executeOneJob({
    invocationId: workerId,
    signal: new AbortController().signal,
    deadlineSignal: new AbortController().signal,
  })).claimed;
}

async function executeOneJob(input: {
  invocationId: string;
  signal: AbortSignal;
  callerSignal?: AbortSignal;
  deadlineSignal: AbortSignal;
}): Promise<JobExecutionCycleResult> {
  const job = await leaseNextJob({
    workerId: input.invocationId,
    kinds: PORTABLE_JOB_KINDS,
    leaseSeconds: LEASE_SECONDS,
  });
  if (!job) return { claimed: false };
  const monitor = monitorJobCancellation(job.id);
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  };
  abort(input.signal);
  abort(input.deadlineSignal);
  abort(monitor.signal);
  try {
    const result = await executeHandler(job, controller.signal);
    await succeedJob({ jobId: job.id, workerId: input.invocationId, result });
    return { claimed: true, outcome: "succeeded" };
  } catch (error) {
    if (monitor.signal.aborted) {
      await finalizeJobCancellation(job.id, input.invocationId);
      return { claimed: true, outcome: "cancelled" };
    }
    await failJob({
      jobId: job.id,
      workerId: input.invocationId,
      errorCode: error instanceof Error ? error.name : "JOB_FAILED",
      safeMessage: error instanceof Error ? error.message : "Job failed",
      retryable: true,
    });
    return { claimed: true, outcome: "failed" };
  } finally {
    monitor.stop();
  }
}

async function executeHandler(job: BackgroundJobRecord, signal: AbortSignal) {
  if (job.kind === "maintenance_cleanup") {
    await runMaintenanceCleanup();
    return { type: "maintenance_cleanup", id: job.id };
  }
  if (job.kind === "legal_source_processing") {
    const processingGenerationId = (job.payload as { processingGenerationId?: string }).processingGenerationId;
    if (!processingGenerationId) throw new Error("Legal-source processing payload is incomplete");
    return executeLegalSourceProcessingJob({
      jobId: job.id,
      processingGenerationId,
      abortSignal: signal,
    });
  }
  if (!job.organizationId) throw new Error("Job organization scope is missing");
  if (job.kind === "gap_analysis") {
    const payload = job.payload as { cycleId?: string; locale?: "de" | "en" };
    if (!payload.cycleId || !payload.locale || !job.requestedBy) throw new Error("Gap job payload is incomplete");
    return executeGapGenerationJob({
      jobId: job.id,
      cycleId: payload.cycleId,
      locale: payload.locale,
      userId: job.requestedBy,
      organizationId: job.organizationId,
      workerId: job.leaseOwner!,
      abortSignal: signal,
    });
  }
  if (job.kind === "gap_conflict_resolution") {
    const payload = job.payload as {
      sourceRevisionId?: string;
      findingId?: string;
      sourceChoice?: "questionnaire" | "document";
    };
    if (!payload.sourceRevisionId || !payload.findingId || !payload.sourceChoice || !job.requestedBy) {
      throw new Error("Gap conflict-resolution payload is incomplete");
    }
    return executeGapContradictionResolutionJob({
      jobId: job.id,
      organizationId: job.organizationId,
      userId: job.requestedBy,
      sourceRevisionId: payload.sourceRevisionId,
      findingId: payload.findingId,
      sourceChoice: payload.sourceChoice,
      abortSignal: signal,
    });
  }
  if (job.kind === "document_indexing") {
    const versionId = (job.payload as { documentVersionId?: string }).documentVersionId;
    if (!versionId) throw new Error("Document indexing payload is incomplete");
    return executeDocumentIndexingJob({ documentVersionId: versionId, organizationId: job.organizationId });
  }
  if (job.kind === "action_plan_generation") return handleActionPlanGeneration(job, signal);
  if (job.kind === "report_render") return handleReportRender(job, signal);
  throw new Error(`No worker handler is configured for ${job.kind}`);
}

export async function runPortableJobDrain(input: DrainJobsInput) {
  return drainJobs(input);
}

export const drainPortableJobs = runPortableJobDrain;
