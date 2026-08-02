import * as z from "zod";
import type { BackgroundJobRecord } from "@/src/server/jobs";
import { executeGapGenerationJob } from "@/src/server/gap-analysis";

const payloadSchema = z.object({
  cycleId: z.uuid(),
  locale: z.enum(["de", "en"]),
  retryNonce: z.string().optional(),
});

export async function handleGapGeneration(
  job: BackgroundJobRecord,
  abortSignal?: AbortSignal,
) {
  const payload = payloadSchema.parse(job.payload);
  if (!job.organizationId || !job.requestedBy) throw new Error("Gap generation job scope is incomplete");
  return executeGapGenerationJob({
    jobId: job.id,
    workerId: job.leaseOwner!,
    organizationId: job.organizationId,
    userId: job.requestedBy,
    abortSignal,
    ...payload,
  });
}
