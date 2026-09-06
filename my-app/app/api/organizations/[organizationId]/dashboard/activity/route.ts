import * as z from "zod";
import {
  dashboardActivityItemSchema,
  dashboardActivityQuerySchema,
} from "@/src/contracts/dashboard";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { parseInput } from "@/src/server/platform/http/request";
import { listDashboardActivity } from "@/src/server/modules/organizations";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(
  async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const query = parseInput(
      dashboardActivityQuerySchema,
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const result = await listDashboardActivity({
      userId: user.id,
      organizationId,
      ...query,
    });
    return {
      data: { activity: z.array(dashboardActivityItemSchema).parse(result.items) },
      meta: { nextCursor: result.nextCursor },
    };
  },
);
