import { revalidatePath } from "next/cache";
import { documentUploadCompletionSchema } from "@/src/contracts/documents";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { readJsonBody } from "@/src/server/platform/http/request";
import { completeDocumentUpload } from "@/src/server/modules/documents";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";
import { runIdempotentCommand } from "@/src/server/platform/http/idempotency";
import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";
import { scheduleAfterResponseDrain } from "@/src/server/platform/jobs/execution/after-response";
export const POST = apiRoute(async ({ request, routeContext, requestId }: { request: Request; routeContext: { params: Promise<{ organizationId: string; sessionId: string }> }; requestId: string }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "uploads:complete", scopeId: params.organizationId });
  const body = await readJsonBody(request, documentUploadCompletionSchema);
  const result = await runIdempotentCommand({
    repository: databaseIdempotencyRepository,
    request,
    actorKey: user.id,
    organizationId: params.organizationId,
    scope: params.organizationId,
    operation: "document-upload.complete",
    requestInput: { sessionId: params.sessionId, ...body },
    resultType: "document_version",
    responseStatus: 201,
    execute: () => completeDocumentUpload({ userId: user.id, ...params, ...body }),
    resultId: (result) => result.internalResultId,
    replay: () => completeDocumentUpload({ userId: user.id, ...params, ...body }),
  });
  scheduleAfterResponseDrain({ requestId });
  revalidatePath(`/tool/organizations/${params.organizationId}/documents`); revalidatePath(`/tool/organizations/${params.organizationId}/gap-analysis`);
  return { status: 201, data: { document: result.value.document } };
});
