import { getLocale } from "@/lib/i18n";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { getApplicabilityAnswersForUser } from "@/src/server/applicability-check";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  return { data: { answers: await getApplicabilityAnswersForUser(user.id, organizationId, await getLocale()) } };
});
