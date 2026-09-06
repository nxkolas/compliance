import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { getGapQuestionnaireProgress } from "@/src/server/modules/gap-analysis";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(
  async ({ routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const progress = await getGapQuestionnaireProgress(user.id, organizationId);

    return { data: { progress } };
  },
);
