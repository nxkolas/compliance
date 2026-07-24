import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { restoreOrganizationDocument } from "@/src/server/documents";
import { requireIfMatch } from "@/src/server/api/concurrency";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; documentId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const document = await restoreOrganizationDocument(user.id, params.organizationId, params.documentId, requireIfMatch(request));
  return { data: { document }, meta: { version: document.version } };
});
