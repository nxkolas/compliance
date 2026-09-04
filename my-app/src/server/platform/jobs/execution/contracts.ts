export const JOB_EXECUTION_ADAPTERS = [
  "after_response",
  "recovery_route",
] as const;

export type JobExecutionAdapter = (typeof JOB_EXECUTION_ADAPTERS)[number];

export const JOB_DRAIN_STOP_REASONS = [
  "empty_queue",
  "max_jobs",
  "deadline",
  "caller_abort",
] as const;

export type JobDrainStopReason = (typeof JOB_DRAIN_STOP_REASONS)[number];

export type DrainJobsInput = {
  invocationId: string;
  adapter: JobExecutionAdapter;
  maxJobs: number;
  deadline: Date;
  signal?: AbortSignal;
  /** Stop leasing new work this long before the handler deadline. */
  deadlineMarginMs?: number;
};

export type DrainJobsResult = {
  invocationId: string;
  adapter: JobExecutionAdapter;
  claimed: number;
  succeeded: number;
  failed: number;
  retried: number;
  cancelled: number;
  /** Handed off to a client's local model and waiting; not an error. */
  parked: number;
  stopReason: JobDrainStopReason;
  durationMs: number;
};

export type JobExecutionOutcome =
  | "succeeded"
  | "failed"
  | "retried"
  | "cancelled"
  | "parked";

export type JobExecutionCycleResult =
  | { claimed: false }
  | { claimed: true; outcome: JobExecutionOutcome };
