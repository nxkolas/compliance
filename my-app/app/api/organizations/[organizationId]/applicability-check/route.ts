import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { getApplicabilityOverviewForUser } from "@/src/server/applicability-check/service";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  return { data: { overview: await getApplicabilityOverviewForUser(user.id, organizationId) } };
});
