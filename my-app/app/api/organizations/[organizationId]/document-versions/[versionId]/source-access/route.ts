import { documentSourceAccessSchema } from "@/src/contracts/documents";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { createDocumentSourceAccess } from "@/src/server/documents";
export const POST = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; versionId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const access = await createDocumentSourceAccess(user.id, params.organizationId, params.versionId);
  documentSourceAccessSchema.parse(access);
  return { data: { access } };
});
