import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { getGapInputs } from "@/src/server/gap-analysis";

export const GET = apiRoute(async ({ routeContext }: {
  routeContext: { params: Promise<{ organizationId: string; revisionId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, revisionId } = await routeContext.params;
  return { data: { inputs: await getGapInputs({ userId: user.id, organizationId, revisionId, locale: await getLocale() }) } };
});
