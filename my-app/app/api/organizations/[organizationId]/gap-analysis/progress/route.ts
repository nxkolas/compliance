import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { getGapQuestionnaireProgress } from "@/src/server/gap-analysis";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(
  async ({ routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const progress = await getGapQuestionnaireProgress(user.id, organizationId);

    return { data: { progress } };
  },
);
