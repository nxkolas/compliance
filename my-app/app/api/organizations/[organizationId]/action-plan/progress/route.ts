import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { getActionPlanProgress } from "@/src/server/modules/action-plans";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(
  async ({ routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const progress = await getActionPlanProgress(user.id, organizationId);

    return { data: { progress } };
  },
);
