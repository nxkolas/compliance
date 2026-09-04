import { getLocale } from "@/lib/i18n";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { getApplicabilityQuestionnaireForUser } from "@/src/server/modules/applicability-check";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  return { data: { questionnaire: await getApplicabilityQuestionnaireForUser(user.id, organizationId, await getLocale()) } };
});
