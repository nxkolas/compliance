import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { readJsonBody } from "@/src/server/api/request";
import { correctGapRevision } from "@/src/server/gap-analysis/review-service";
import { gapCorrectionInputSchema as gapCorrectionRequestSchema } from "@/src/contracts/gap-analysis/generation";
import { getGapAnalysisRevisionRecord } from "@/src/server/gap-analysis/workflow-reader";
import { runIdempotentCommand } from "@/src/server/api/idempotency";
import { databaseIdempotencyRepository } from "@/src/server/idempotency/repository";
import { ApiError } from "@/src/server/api/errors";

export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; revisionId: string }> } }) => {
  const user = await requireApiUser();
  const { organizationId, revisionId } = await routeContext.params;
  const body = await readJsonBody(request, gapCorrectionRequestSchema);
  const result = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, scope: organizationId, operation: "gap-revision.correct", requestInput: { sourceRevisionId: revisionId, ...body }, resultType: "generated_artifact_revision", responseStatus: 201, execute: () => correctGapRevision({ userId: user.id, organizationId, sourceRevisionId: revisionId, ...body }), resultId: (revision) => revision.id, replay: async (id) => { const revision = await getGapAnalysisRevisionRecord({ userId: user.id, organizationId, revisionId: id }); if (!revision) throw new ApiError(409, "Corrected revision is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE"); return revision; } });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { status: 201, data: { revision: result.value, reused: result.reused } };
});
