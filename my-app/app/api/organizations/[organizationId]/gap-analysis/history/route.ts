import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { getGapHistory } from "@/src/server/gap-analysis";

export const GET = apiRoute(async ({ routeContext }: {
  routeContext: { params: Promise<{ organizationId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  return { data: { history: await getGapHistory(user.id, organizationId, await getLocale()) } };
});
