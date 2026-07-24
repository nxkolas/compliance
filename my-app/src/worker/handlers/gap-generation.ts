import * as z from "zod";
import type { BackgroundJobRecord } from "@/src/server/jobs";
import { executeGapGenerationJob } from "@/src/server/gap-analysis";

const payloadSchema = z.object({
  draftId: z.uuid(),
  locale: z.enum(["de", "en"]),
  retryNonce: z.string().optional(),
});

export async function handleGapGeneration(job: BackgroundJobRecord) {
  const payload = payloadSchema.parse(job.payload);
  if (!job.organizationId || !job.requestedByUserId) throw new Error("Gap generation job scope is incomplete");
  return executeGapGenerationJob({
    jobId: job.id,
    organizationId: job.organizationId,
    userId: job.requestedByUserId,
    ...payload,
  });
}
