import { organizationIdSchema } from "@/src/contracts/common/ids";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { parseInput } from "@/src/server/platform/http/request";
import { getOrganizationProgress } from "@/src/server/modules/organizations";

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
