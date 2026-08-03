import { memberUpdateSchema } from "@/src/contracts/organizations";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { readJsonBody } from "@/src/server/api/request";
import {
  removeOrganizationMember,
  updateOrganizationMember,
} from "@/src/server/organizations/service";

type Context = {
  params: Promise<{ organizationId: string; userId: string }>;
};

export const PATCH = apiRoute(
  async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
    const actor = await requireApiUser();
    const { organizationId, userId } = await routeContext.params;
    const member = await updateOrganizationMember({
      userId: actor.id,
      organizationId,
      memberUserId: userId,
      ...(await readJsonBody(request, memberUpdateSchema)),
    });
    return { data: { member } };
  },
);

export const DELETE = apiRoute(
  async ({ routeContext }: { request: Request; routeContext: Context }) => {
    const actor = await requireApiUser();
    const { organizationId, userId } = await routeContext.params;
    const member = await removeOrganizationMember({
      userId: actor.id,
      organizationId,
      memberUserId: userId,
    });
    return { data: { member } };
  },
);
