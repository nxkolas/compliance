import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { listOrganizationMembersPage } from "@/src/server/modules/organizations";
import { paginationQuerySchema } from "@/src/contracts/common/pagination";
import { parseInput } from "@/src/server/platform/http/request";
import { synchronizeAuthenticatedActor } from "@/src/server/platform/auth/user-directory";
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  await synchronizeAuthenticatedActor(user);
  const query = parseInput(paginationQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listOrganizationMembersPage({ userId: user.id, organizationId, ...query });
  return {
    data: { members: result.members, controls: result.controls },
    meta: { nextCursor: result.nextCursor },
  };
});
