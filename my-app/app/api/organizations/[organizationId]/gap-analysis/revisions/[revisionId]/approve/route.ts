import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { approveGapRevision } from "@/src/server/gap-analysis/review-service";
import { getGapAnalysisRevision } from "@/src/server/gap-analysis/workflow-reader";
import { runIdempotentCommand } from "@/src/server/api/idempotency";
import { databaseIdempotencyRepository } from "@/src/server/idempotency/repository";
import { ApiError } from "@/src/server/api/errors";

export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; revisionId: string }> } }) => {
  const user = await requireApiUser();
  const { organizationId, revisionId } = await routeContext.params;
  const result = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, scope: organizationId, operation: "gap-revision.approve", requestInput: { revisionId }, resultType: "generated_artifact_revision", responseStatus: 200, execute: () => approveGapRevision({ userId: user.id, organizationId, revisionId }), resultId: (revision) => revision.id, replay: async (id) => { const value = await getGapAnalysisRevision({ userId: user.id, organizationId, revisionId: id }); if (!value) throw new ApiError(409, "Approved revision is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE"); return value.revision; } });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
  return { data: { revision: result.value, reused: result.reused } };
});
