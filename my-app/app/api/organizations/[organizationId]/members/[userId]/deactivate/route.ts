import { requireApiUser } from "@/src/server/api/auth";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { apiRoute } from "@/src/server/api/handler";
import { removeOrganizationMember } from "@/src/server/organizations/service";

export const POST = apiRoute(async ({
  request,
  routeContext,
}: {
  request: Request;
  routeContext: {
    params: Promise<{ organizationId: string; userId: string }>;
  };
}) => {
  const actor = await requireApiUser();
  const { organizationId, userId } = await routeContext.params;
  const member = await removeOrganizationMember({
    userId: actor.id,
    organizationId,
    memberUserId: userId,
    expectedVersion: requireIfMatch(request),
  });
  return { data: { member }, meta: { version: member.version } };
});
