import * as z from "zod";
import type { BackgroundJobRecord } from "@/src/server/jobs";
import { executeActionPlanGenerationJob } from "@/src/server/action-plans";
import { actionPlanDefinitionHash } from "@/src/server/action-plans/current-contract";
import { currentGapDefinitionHash } from "@/src/server/definitions";

const payloadSchema = z.object({
  sourceGapRevisionId: z.uuid(),
  locale: z.enum(["de", "en"]),
  gapDefinitionHash: z.literal(currentGapDefinitionHash),
  actionPlanDefinitionHash: z.literal(actionPlanDefinitionHash),
});

export async function handleActionPlanGeneration(
  job: BackgroundJobRecord,
  abortSignal?: AbortSignal,
) {
  const payload = payloadSchema.parse(job.payload);
  if (!job.organizationId || !job.requestedBy) {
    throw new Error("Action Plan generation job scope is incomplete");
  }
  if (!job.leaseOwner) {
    throw new Error("Action Plan generation job lease owner is missing");
  }
  return executeActionPlanGenerationJob({
    jobId: job.id,
    organizationId: job.organizationId,
    userId: job.requestedBy,
    workerId: job.leaseOwner,
    attemptCount: job.attemptCount,
    abortSignal,
    ...payload,
  });
}
