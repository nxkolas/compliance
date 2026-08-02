import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError } from "@/src/server/api/errors";
import { getGapAnalysisRevision } from "@/src/server/gap-analysis";

export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; revisionId: string }> } }) => {
  const user = await requireApiUser();
  const { organizationId, revisionId } = await routeContext.params;
  const result = await getGapAnalysisRevision(user.id, organizationId, revisionId);
  if (!result) throw new ApiError(404, "Gap revision not found", undefined, "GAP_REVISION_NOT_FOUND");
  return { data: result };
});
