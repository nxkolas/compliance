import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { getOrganizationDashboard } from "@/src/server/dashboard/service";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  return { data: { dashboard: await getOrganizationDashboard(user.id, organizationId) } };
});
