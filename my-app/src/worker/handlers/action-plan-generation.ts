import * as z from "zod";
import type { BackgroundJobRecord } from "@/src/server/jobs";
import { executeActionPlanGenerationJob } from "@/src/server/action-plans";

const payloadSchema = z.object({
  sourceGapRevisionId: z.uuid(),
  locale: z.enum(["de", "en"]),
  publishedReleaseQa: z.literal(true).optional(),
});

export async function handleActionPlanGeneration(
  job: BackgroundJobRecord,
  abortSignal?: AbortSignal,
) {
  const payload = payloadSchema.parse(job.payload);
  if (!job.organizationId || !job.requestedByUserId) {
    throw new Error("Action Plan generation job scope is incomplete");
  }
  return executeActionPlanGenerationJob({
    jobId: job.id,
    organizationId: job.organizationId,
    userId: job.requestedByUserId,
    attemptCount: job.attemptCount,
    abortSignal,
    ...payload,
  });
}
