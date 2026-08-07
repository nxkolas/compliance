import { ensureScheduledCleanupJob } from "@/src/server/api/cleanup";
import {
  failJob,
  finalizeJobCancellation,
  heartbeatJob,
  leaseNextJob,
  monitorJobCancellation,
  parkJob,
  succeedJob,
} from "@/src/server/jobs";
import { isClientInferenceSuspended } from "@/src/server/ai/client-inference/types";
import {
  classifyJobFailure,
  executePersistedJob,
} from "@/src/server/jobs/definitions";
import { createJobDrain } from "./drain";
import type { DrainJobsInput, JobExecutionCycleResult } from "./contracts";

const LEASE_SECONDS = 60;
const HEARTBEAT_INTERVAL_MS = 20_000;
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
    leaseSeconds: LEASE_SECONDS,
  });
  if (!job) return { claimed: false };
  const heartbeat = setInterval(() => {
    void heartbeatJob({
      jobId: job.id,
      workerId: input.invocationId,
      leaseSeconds: LEASE_SECONDS,
    }).catch((error) => {
      console.error("Worker heartbeat failed", {
        jobId: job.id,
        errorType: error instanceof Error ? error.name : "unknown",
      });
    });
  }, HEARTBEAT_INTERVAL_MS);
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
    const result = await executePersistedJob(job, controller.signal);
    await succeedJob({ jobId: job.id, workerId: input.invocationId, result });
    return { claimed: true, outcome: "succeeded" };
  } catch (error) {
    if (monitor.signal.aborted) {
      await finalizeJobCancellation(job.id, input.invocationId);
      return { claimed: true, outcome: "cancelled" };
    }
    // Handed off to a client's local model, not failed. The job returns to the
    // queue with its attempt refunded and resumes when the client posts its
    // result -- that request's own after-response drain is what wakes it.
    if (isClientInferenceSuspended(error)) {
      await parkJob({
        jobId: job.id,
        workerId: input.invocationId,
        reason: "awaiting_client_inference",
        retryAfterSeconds: error.detail.retryAfterSeconds,
      });
      return { claimed: true, outcome: "parked" };
    }
    const executionInterruption = input.deadlineSignal.aborted
      ? { code: "JOB_EXECUTION_DEADLINE", retryable: true }
      : input.callerSignal?.aborted
        ? { code: "JOB_EXECUTION_ABORTED", retryable: true }
        : null;
    const failure = executionInterruption
      ? {
          cancellation: false,
          code: executionInterruption.code,
          retryable: executionInterruption.retryable,
        }
      : classifyJobFailure(job, error);
    if (failure.cancellation) {
      await finalizeJobCancellation(job.id, input.invocationId);
      return { claimed: true, outcome: "cancelled" };
    }
    const failed = await failJob({
      jobId: job.id,
      workerId: input.invocationId,
      errorCode: failure.code,
      safeMessage: "The background operation failed.",
      retryable: failure.retryable,
      retryDelaySeconds: failure.retryDelaySeconds,
    });
    return {
      claimed: true,
      outcome: failed.state === "queued" ? "retried" : "failed",
    };
  } finally {
    clearInterval(heartbeat);
    monitor.stop();
  }
}

export async function runPortableJobDrain(input: DrainJobsInput) {
  return drainJobs(input);
}

export const drainPortableJobs = runPortableJobDrain;
