import { createUploadSessionRequestSchema } from "@/src/contracts/common/uploads";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { readJsonBody } from "@/src/server/api/request";
import { createDocumentUploadSession } from "@/src/server/documents";
import { enforceOperationRateLimit } from "@/src/server/api/operation-rate-limit";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; documentId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "uploads:create", scopeId: params.organizationId });
  return { status: 201, data: { upload: await createDocumentUploadSession({ userId: user.id, ...params, ...await readJsonBody(request, createUploadSessionRequestSchema) }) } };
});
