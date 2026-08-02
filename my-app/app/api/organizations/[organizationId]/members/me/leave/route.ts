import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { leaveOrganization } from "@/src/server/organizations/service";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const member = await leaveOrganization({ userId: user.id, organizationId });
  return { data: { member } };
});
