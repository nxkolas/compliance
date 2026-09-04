import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { getGapHistory } from "@/src/server/modules/gap-analysis";

export const GET = apiRoute(async ({ routeContext }: {
  routeContext: { params: Promise<{ organizationId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  return { data: { history: await getGapHistory(user.id, organizationId, await getLocale()) } };
});
