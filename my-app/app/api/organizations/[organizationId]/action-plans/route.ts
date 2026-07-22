import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { getActionPlanHistoryPage } from "@/src/server/action-plans/service";
import { paginationQuerySchema } from "@/src/contracts/common/pagination";
import { parseInput } from "@/src/server/api/request";
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const query = parseInput(paginationQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await getActionPlanHistoryPage({ userId: user.id, organizationId, ...query });
  return { data: { plans: result.plans }, meta: { nextCursor: result.nextCursor } };
});
