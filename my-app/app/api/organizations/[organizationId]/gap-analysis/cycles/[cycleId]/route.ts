import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { getGapAnalysisCycle } from "@/src/server/modules/gap-analysis";

export const GET = apiRoute(async ({ routeContext }: {
  routeContext: { params: Promise<{ organizationId: string; cycleId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, cycleId } = await routeContext.params;
  return { data: { analysisCycle: await getGapAnalysisCycle({ userId: user.id, organizationId, draftId: cycleId, locale: await getLocale() }) } };
});
