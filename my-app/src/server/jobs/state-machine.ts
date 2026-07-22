import { ApiError } from "../api/errors";

export type JobState =
  | "queued"
  | "running"
  | "cancellation_requested"
  | "succeeded"
  | "failed"
  | "cancelled";

export function isJobTerminal(state: JobState) {
  return state === "succeeded" || state === "failed" || state === "cancelled";
}

export function canLeaseJob(
  job: { state: JobState; runAfter: Date; leaseExpiresAt: Date | null },
  now: Date,
) {
  return (
    (job.state === "queued" && job.runAfter <= now) ||
    ((job.state === "running" || job.state === "cancellation_requested") && Boolean(job.leaseExpiresAt && job.leaseExpiresAt <= now))
  );
}

export function nextFailureState(attemptCount: number, maxAttempts: number) {
  return attemptCount < maxAttempts ? "queued" as const : "failed" as const;
}

export function cancellationTransition(state: JobState, cancellable: boolean) {
  if (!cancellable || isJobTerminal(state)) {
    throw new ApiError(409, "The job cannot be cancelled", undefined, "JOB_NOT_CANCELLABLE");
  }
  return state === "queued" ? "cancelled" as const : "cancellation_requested" as const;
}
