import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { getApplicabilityResultForUser } from "@/src/server/applicability-check";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  return { data: { result: await getApplicabilityResultForUser(user.id, organizationId) } };
});
