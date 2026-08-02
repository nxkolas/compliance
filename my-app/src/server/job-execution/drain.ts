import { combineAbortSignals } from "@/src/server/ai/generation";
import {
  JOB_EXECUTION_ADAPTERS,
  type DrainJobsInput,
  type DrainJobsResult,
  type JobExecutionCycleResult,
} from "./contracts";

const DEFAULT_DEADLINE_MARGIN_MS = 5_000;

type DrainDependencies = {
  now(): number;
  ensureSchedules(): Promise<void>;
  runOneCycle(input: {
    invocationId: string;
    signal: AbortSignal;
    callerSignal?: AbortSignal;
    deadlineSignal: AbortSignal;
  }): Promise<JobExecutionCycleResult>;
};

export function createJobDrain(dependencies: DrainDependencies) {
  return async function drainJobs(input: DrainJobsInput): Promise<DrainJobsResult> {
    const startedAt = dependencies.now();
    const marginMs = input.deadlineMarginMs ?? DEFAULT_DEADLINE_MARGIN_MS;
    validateInput(input, startedAt, marginMs);

    const result: Omit<DrainJobsResult, "stopReason" | "durationMs"> = {
      invocationId: input.invocationId,
      adapter: input.adapter,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      retried: 0,
      cancelled: 0,
    };
    const abortStopReason = input.abortStopReason ?? "caller_abort";
    const deadlineController = new AbortController();
    const deadlineDelayMs = Math.max(0, input.deadline.getTime() - startedAt);
    const deadlineTimer = setTimeout(
      () => deadlineController.abort("job_execution_deadline"),
      deadlineDelayMs,
    );
    deadlineTimer.unref?.();
    const signal = combineAbortSignals([
      input.signal,
      deadlineController.signal,
    ]);

    const finish = (stopReason: DrainJobsResult["stopReason"]): DrainJobsResult => ({
      ...result,
      stopReason,
      durationMs: Math.max(0, dependencies.now() - startedAt),
    });

    try {
      if (input.signal?.aborted) return finish(abortStopReason);
      if (deadlineReached(input, dependencies.now(), marginMs)) {
        return finish("deadline");
      }

      await dependencies.ensureSchedules();

      while (true) {
        if (input.signal?.aborted) return finish(abortStopReason);
        if (deadlineReached(input, dependencies.now(), marginMs)) {
          return finish("deadline");
        }
        if (result.claimed >= input.maxJobs) return finish("max_jobs");

        const cycle = await dependencies.runOneCycle({
          invocationId: input.invocationId,
          signal,
          callerSignal: input.signal,
          deadlineSignal: deadlineController.signal,
        });
        if (!cycle.claimed) return finish("empty_queue");

        result.claimed += 1;
        result[cycle.outcome] += 1;
      }
    } finally {
      clearTimeout(deadlineTimer);
    }
  };
}

function validateInput(
  input: DrainJobsInput,
  now: number,
  marginMs: number,
) {
  if (!input.invocationId.trim()) {
    throw new TypeError("Job drain invocationId must not be empty");
  }
  if (!JOB_EXECUTION_ADAPTERS.includes(input.adapter)) {
    throw new TypeError("Job drain adapter is invalid");
  }
  if (!Number.isSafeInteger(input.maxJobs) || input.maxJobs < 1) {
    throw new TypeError("Job drain maxJobs must be a positive safe integer");
  }
  if (!Number.isFinite(input.deadline.getTime()) || input.deadline.getTime() <= now) {
    throw new TypeError("Job drain deadline must be in the future");
  }
  if (!Number.isSafeInteger(marginMs) || marginMs < 0) {
    throw new TypeError("Job drain deadlineMarginMs must be a non-negative safe integer");
  }
  if (
    input.abortStopReason !== undefined &&
    input.abortStopReason !== "caller_abort" &&
    input.abortStopReason !== "graceful_shutdown"
  ) {
    throw new TypeError("Job drain abortStopReason is invalid");
  }
}

function deadlineReached(
  input: DrainJobsInput,
  now: number,
  marginMs: number,
) {
  return now >= input.deadline.getTime() - marginMs;
}
