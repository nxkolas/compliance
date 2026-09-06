import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { getApplicabilityAnswersForUser } from "@/src/server/modules/applicability-check";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  return { data: { answers: await getApplicabilityAnswersForUser(user.id, organizationId) } };
});
