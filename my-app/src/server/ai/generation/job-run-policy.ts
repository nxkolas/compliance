import { GenerationFailure } from "./failures";

export function assertLiveParentForAiRun(
  parent:
    | {
        organizationId: string | null;
        state: string;
        cancellationRequestedAt: Date | null;
        leaseOwner: string | null;
        leaseExpiresAt: Date | null;
      }
    | undefined,
  input: { now: Date; organizationId: string | null },
) {
  if (!parent) {
    throw new GenerationFailure(
      "terminal_input",
      "GENERATION_PARENT_JOB_NOT_FOUND",
    );
  }
  if (
    parent.state === "cancelled" ||
    parent.state === "cancellation_requested" ||
    parent.cancellationRequestedAt !== null
  ) {
    throw new GenerationFailure("cancelled", "GENERATION_CANCELLED");
  }
  if (parent.state === "failed" || parent.state === "succeeded") {
    throw new GenerationFailure("terminal_policy", "PARENT_JOB_TERMINATED");
  }
  if (parent.state !== "running") {
    throw new GenerationFailure(
      "terminal_input",
      "GENERATION_PARENT_JOB_NOT_RUNNING",
    );
  }
  if (
    !parent.leaseOwner ||
    !parent.leaseExpiresAt ||
    parent.leaseExpiresAt <= input.now
  ) {
    throw new GenerationFailure(
      "transient_provider",
      "GENERATION_JOB_LEASE_LOST",
    );
  }
  if (parent.organizationId !== input.organizationId) {
    throw new GenerationFailure(
      "terminal_policy",
      "GENERATION_PARENT_JOB_SCOPE_MISMATCH",
    );
  }
}
