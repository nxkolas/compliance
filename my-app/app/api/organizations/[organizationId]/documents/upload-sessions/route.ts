import { createUploadSessionRequestSchema } from "@/src/contracts/common/uploads";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { readJsonBody } from "@/src/server/platform/http/request";
import { createDocumentUploadSession } from "@/src/server/modules/documents";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "uploads:create", scopeId: organizationId });
  return { status: 201, data: { upload: await createDocumentUploadSession({ userId: user.id, organizationId, ...await readJsonBody(request, createUploadSessionRequestSchema) }) } };
});
