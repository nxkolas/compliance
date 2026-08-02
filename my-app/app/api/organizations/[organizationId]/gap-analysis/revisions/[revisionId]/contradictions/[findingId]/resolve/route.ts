import { revalidatePath } from "next/cache";
import { gapContradictionResolutionSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { runIdempotentCommand } from "@/src/server/api/idempotency";
import { readJsonBody } from "@/src/server/api/request";
import { enqueueGapContradictionResolution } from "@/src/server/gap-analysis";
import { databaseIdempotencyRepository } from "@/src/server/idempotency";
import { getAuthorizedJob, toJobDto } from "@/src/server/jobs";

type Context = {
  params: Promise<{
    organizationId: string;
    revisionId: string;
    findingId: string;
  }>;
};

export const POST = apiRoute(async ({ request, routeContext }: {
  request: Request;
  routeContext: Context;
}) => {
  const user = await requireApiUser();
  const { organizationId, revisionId, findingId } = await routeContext.params;
  const body = await readJsonBody(request, gapContradictionResolutionSchema);
  const result = await runIdempotentCommand({
    repository: databaseIdempotencyRepository,
    request,
    actorKey: user.id,
    scope: organizationId,
    operation: "gap.contradiction.resolve",
    requestInput: { revisionId, findingId, ...body },
    resultType: "background_job",
    responseStatus: 202,
    execute: async () => toJobDto(await enqueueGapContradictionResolution({
      userId: user.id,
      organizationId,
      revisionId,
      findingId,
      sourceChoice: body.sourceChoice,
    })),
    resultId: (job) => job.id,
    replay: (jobId) => getAuthorizedJob(user.id, jobId),
  });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { status: 202, data: { job: result.value, reused: result.reused } };
});
