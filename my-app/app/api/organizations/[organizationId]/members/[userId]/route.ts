import { memberUpdateSchema } from "@/src/contracts/organizations";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { readJsonBody } from "@/src/server/api/request";
import { updateOrganizationMember } from "@/src/server/organizations/service";
export const PATCH = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; userId: string }> } }) => {
  const actor = await requireApiUser(); const { organizationId, userId } = await routeContext.params;
  const member = await updateOrganizationMember({ userId: actor.id, organizationId, memberUserId: userId, expectedVersion: requireIfMatch(request), ...await readJsonBody(request, memberUpdateSchema) });
  return { data: { member }, meta: { version: member.version } };
});
