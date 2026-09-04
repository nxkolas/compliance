import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { getGapInputs } from "@/src/server/modules/gap-analysis";

export const GET = apiRoute(async ({ routeContext }: {
  routeContext: { params: Promise<{ organizationId: string; revisionId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, revisionId } = await routeContext.params;
  return { data: { inputs: await getGapInputs(user.id, organizationId, revisionId, await getLocale()) } };
});
