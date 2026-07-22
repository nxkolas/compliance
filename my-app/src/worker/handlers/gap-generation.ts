import * as z from "zod";
import type { backgroundJobs } from "@/src/db/schema";
import { executeGapGenerationJob } from "@/src/server/gap-analysis/reassessment-service";

const payloadSchema = z.object({
  draftId: z.uuid(),
  locale: z.enum(["de", "en"]),
  retryNonce: z.string().optional(),
});

export async function handleGapGeneration(job: typeof backgroundJobs.$inferSelect) {
  const payload = payloadSchema.parse(job.payload);
  if (!job.organizationId || !job.requestedByUserId) throw new Error("Gap generation job scope is incomplete");
  return executeGapGenerationJob({
    jobId: job.id,
    organizationId: job.organizationId,
    userId: job.requestedByUserId,
    ...payload,
  });
}
