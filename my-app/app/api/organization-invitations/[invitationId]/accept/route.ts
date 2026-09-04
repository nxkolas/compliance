import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { acceptMailboxInvitation } from "@/src/server/modules/organizations";
import { synchronizeAuthenticatedActor } from "@/src/server/platform/auth/user-directory";
export const POST = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ invitationId: string }> } }) => {
  const user = await requireApiUser(); const { invitationId } = await routeContext.params;
  await synchronizeAuthenticatedActor(user);
  return { data: { invitation: await acceptMailboxInvitation(user, invitationId) } };
});
