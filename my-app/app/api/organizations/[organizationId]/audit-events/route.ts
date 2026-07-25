import { auditQuerySchema } from "@/src/contracts/audit";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { parseInput } from "@/src/server/api/request";
import { listOrganizationAuditEvents } from "@/src/server/audit/read-service";
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params; const url = new URL(request.url);
  const query = parseInput(auditQuerySchema, Object.fromEntries(url.searchParams));
  const result = await listOrganizationAuditEvents({ userId: user.id, organizationId, ...query });
  return { data: { events: result.events }, meta: { nextCursor: result.nextCursor } };
});
