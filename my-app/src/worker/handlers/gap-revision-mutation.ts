import { gapRevisionMutationPayloadSchema } from "@/src/contracts/gap-analysis/generation";
import { executeGapRevisionMutation } from "@/src/server/gap-analysis";
import type { BackgroundJobRecord } from "@/src/server/jobs";

export async function handleGapRevisionMutation(
  job: BackgroundJobRecord,
  abortSignal?: AbortSignal,
) {
  if (!job.organizationId || !job.requestedByUserId || !job.leaseOwner) {
    throw new Error("Gap revision mutation job scope is incomplete");
  }
  return executeGapRevisionMutation({
    jobId: job.id,
    workerId: job.leaseOwner,
    userId: job.requestedByUserId,
    organizationId: job.organizationId,
    payload: gapRevisionMutationPayloadSchema.parse(job.payload),
    abortSignal,
  });
}
