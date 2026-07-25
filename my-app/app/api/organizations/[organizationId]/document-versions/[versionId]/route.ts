import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError } from "@/src/server/api/errors";
import { getOrganizationDocumentVersion } from "@/src/server/documents";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; versionId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const version = await getOrganizationDocumentVersion(user.id, params.organizationId, params.versionId);
  if (!version) throw new ApiError(404, "Document version not found", undefined, "DOCUMENT_VERSION_NOT_FOUND");
  return { data: { version } };
});
