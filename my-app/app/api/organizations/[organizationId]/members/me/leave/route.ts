import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { leaveOrganization } from "@/src/server/organizations/service";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const member = await leaveOrganization({ userId: user.id, organizationId, expectedVersion: requireIfMatch(request) });
  return { data: { member }, meta: { version: member.version } };
});
