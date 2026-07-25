import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { acceptMailboxInvitation } from "@/src/server/organizations/service";
export const POST = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ invitationId: string }> } }) => {
  const user = await requireApiUser(); const { invitationId } = await routeContext.params;
  return { data: { invitation: await acceptMailboxInvitation(user, invitationId) } };
});
