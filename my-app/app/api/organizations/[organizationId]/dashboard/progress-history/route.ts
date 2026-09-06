import {
  dashboardProgressHistoryQuerySchema,
  dashboardProgressHistorySchema,
} from "@/src/contracts/dashboard";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { parseInput } from "@/src/server/platform/http/request";
import { getDashboardProgressHistory } from "@/src/server/modules/organizations";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(
  async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const query = parseInput(
      dashboardProgressHistoryQuerySchema,
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const history = await getDashboardProgressHistory({
      userId: user.id,
      organizationId,
      ...query,
    });
    return {
      data: { history: dashboardProgressHistorySchema.parse(history) },
    };
  },
);
