import { ApiError } from "@/src/server/api/errors";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { getActionPlanDetail } from "@/src/server/action-plans/service";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; planId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  if (!/^[0-9a-f-]{36}$/i.test(params.planId)) throw new ApiError(400, "Invalid plan id", undefined, "INVALID_PATH_PARAMETER");
  return { data: { plan: await getActionPlanDetail(user.id, params.organizationId, params.planId) } };
});
