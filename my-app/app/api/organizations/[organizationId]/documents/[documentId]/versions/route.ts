import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError } from "@/src/server/api/errors";
import { listOrganizationDocumentVersionsPage } from "@/src/server/documents/service";
import { paginationQuerySchema } from "@/src/contracts/common/pagination";
import { parseInput } from "@/src/server/api/request";
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; documentId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const query = parseInput(paginationQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listOrganizationDocumentVersionsPage({ userId: user.id, ...params, ...query });
  if (!result) throw new ApiError(404, "Document not found", undefined, "DOCUMENT_NOT_FOUND");
  return { data: { versions: result.versions }, meta: { nextCursor: result.nextCursor } };
});
