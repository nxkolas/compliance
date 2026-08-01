import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { getGapAnalysisCycle } from "@/src/server/gap-analysis";

export const GET = apiRoute(async ({ routeContext }: {
  routeContext: { params: Promise<{ organizationId: string; cycleId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, cycleId } = await routeContext.params;
  return { data: { analysisCycle: await getGapAnalysisCycle({ userId: user.id, organizationId, draftId: cycleId, locale: await getLocale() }) } };
});
