import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { getApplicabilityOverviewForUser } from "@/src/server/modules/applicability-check";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  return { data: { overview: await getApplicabilityOverviewForUser(user.id, organizationId) } };
});
