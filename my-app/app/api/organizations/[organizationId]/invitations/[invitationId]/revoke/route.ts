import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { revokeOrganizationInvitation } from "@/src/server/organizations/service";
export const POST = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; invitationId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  return { data: { invitation: await revokeOrganizationInvitation({ userId: user.id, ...params }) } };
});
