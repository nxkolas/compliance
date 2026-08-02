import { ApiError } from "@/src/server/api/errors";

export function assertActionPlanPublicationLease(
  job: {
    state: string;
    leaseOwner: string | null;
    leaseExpiresAt: Date | null;
    cancellationRequestedAt: Date | null;
  } | undefined,
  input: { workerId: string; now: Date },
) {
  if (
    !job ||
    job.state !== "running" ||
    job.leaseOwner !== input.workerId ||
    !job.leaseExpiresAt ||
    job.leaseExpiresAt <= input.now ||
    job.cancellationRequestedAt
  ) {
    throw new ApiError(
      409,
      "Action Plan generation no longer owns publication",
      undefined,
      "ACTION_PLAN_GENERATION_RESERVATION_INVALID",
    );
  }
}
