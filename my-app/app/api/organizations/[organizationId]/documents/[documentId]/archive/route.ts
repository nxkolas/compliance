import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { archiveOrganizationDocument } from "@/src/server/documents/service";
import { requireIfMatch } from "@/src/server/api/concurrency";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; documentId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const document = await archiveOrganizationDocument(user.id, params.organizationId, params.documentId, requireIfMatch(request));
  revalidatePath(`/tool/organizations/${params.organizationId}/documents`); revalidatePath(`/tool/organizations/${params.organizationId}/gap-analysis`);
  return { data: { document }, meta: { version: document.version } };
});
