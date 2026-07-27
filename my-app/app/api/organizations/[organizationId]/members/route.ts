import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { listOrganizationMembersPage } from "@/src/server/organizations/service";
import { paginationQuerySchema } from "@/src/contracts/common/pagination";
import { parseInput } from "@/src/server/api/request";
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const query = parseInput(paginationQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listOrganizationMembersPage({ userId: user.id, organizationId, ...query });
  return {
    data: { members: result.members, controls: result.controls },
    meta: { nextCursor: result.nextCursor },
  };
});
