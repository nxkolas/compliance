import { getLocale } from "@/lib/i18n";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { getGapAnalysisWorkflow } from "@/src/server/modules/gap-analysis";

export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const workflow = await getGapAnalysisWorkflow({ userId: user.id, organizationId, locale: await getLocale() });
  return { data: { workflow } };
});
