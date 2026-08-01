import { revalidatePath } from "next/cache";
import { gapGuidanceRegenerationInputSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { requireIdempotencyKey, runIdempotentCommand } from "@/src/server/api/idempotency";
import { readJsonBody } from "@/src/server/api/request";
import { enqueueGapRevisionMutation } from "@/src/server/gap-analysis";
import { getAuthorizedJob } from "@/src/server/jobs";
import { databaseIdempotencyRepository } from "@/src/server/idempotency";

export const POST = apiRoute(async ({ request, routeContext }: {
  request: Request;
  routeContext: { params: Promise<{ organizationId: string; revisionId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, revisionId } = await routeContext.params;
  const body = await readJsonBody(request, gapGuidanceRegenerationInputSchema);
  const retryNonce = body.retryNonce ?? requireIdempotencyKey(request);
  const payload = {
    mode: "guidance_regeneration" as const,
    sourceRevisionId: revisionId,
    findingId: body.findingId,
    reason: body.reason,
    retryNonce,
  };
  const result = await runIdempotentCommand({
    repository: databaseIdempotencyRepository,
    request,
    actorKey: user.id,
    organizationId,
    scope: organizationId,
    operation: "gap-revision-mutation.guidance-v1",
    requestInput: payload,
    resultType: "background_job",
    responseStatus: 202,
    execute: () => enqueueGapRevisionMutation({ userId: user.id, organizationId, payload }),
    resultId: (value) => value.job.id,
    replay: async (jobId) => ({ job: await getAuthorizedJob(user.id, jobId) }),
  });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { status: 202, data: { job: result.value.job, reused: result.reused } };
});
