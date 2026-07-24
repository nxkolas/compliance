import { documentUpdateSchema } from "@/src/contracts/documents";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { ApiError } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { getOrganizationDocumentDetail, updateOrganizationDocument } from "@/src/server/documents";
type Context = { params: Promise<{ organizationId: string; documentId: string }> };
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const document = await getOrganizationDocumentDetail(user.id, params.organizationId, params.documentId);
  if (!document) throw new ApiError(404, "Document not found", undefined, "DOCUMENT_NOT_FOUND");
  return { data: { document }, meta: { version: document.document.version } };
});
export const PATCH = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const body = await readJsonBody(request, documentUpdateSchema);
  const document = await updateOrganizationDocument({ userId: user.id, ...params, title: body.title, expectedVersion: requireIfMatch(request) });
  return { data: { document }, meta: { version: document.version } };
});
