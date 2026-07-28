import { organizationIdSchema } from "@/src/contracts/common/ids";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { parseInput } from "@/src/server/api/request";
import { getOrganizationProgress } from "@/src/server/organization-progress/service";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = apiRoute<RouteContext>(
  async ({ routeContext }) => {
    const { organizationId } = await routeContext.params;
    const parsedOrganizationId = parseInput(
      organizationIdSchema,
      organizationId,
      "Invalid organizationId",
    );
    const user = await requireApiUser();

    return {
      data: {
        progress: await getOrganizationProgress(user.id, parsedOrganizationId),
      },
    };
  },
);
