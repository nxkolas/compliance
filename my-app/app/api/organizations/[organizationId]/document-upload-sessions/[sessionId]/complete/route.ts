import { revalidatePath } from "next/cache";
import { documentUploadCompletionSchema } from "@/src/contracts/documents";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { readJsonBody } from "@/src/server/api/request";
import { completeDocumentUpload } from "@/src/server/documents/service";
import { enforceOperationRateLimit } from "@/src/server/api/operation-rate-limit";
import { runIdempotentCommand } from "@/src/server/api/idempotency";
import { databaseIdempotencyRepository } from "@/src/server/idempotency/repository";
import { getOrganizationDocumentVersion } from "@/src/server/documents/service";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; sessionId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "uploads:complete", scopeId: params.organizationId });
  const body = await readJsonBody(request, documentUploadCompletionSchema);
  const result = await runIdempotentCommand({
    repository: databaseIdempotencyRepository,
    request,
    actorKey: user.id,
    scope: params.organizationId,
    operation: "document-upload.complete",
    requestInput: { sessionId: params.sessionId, ...body },
    resultType: "document_version",
    responseStatus: 201,
    execute: () => completeDocumentUpload({ userId: user.id, ...params, ...body }),
    resultId: (document) => document.documentVersionId,
    replay: async (versionId) => {
      const row = await getOrganizationDocumentVersion(user.id, params.organizationId, versionId);
      if (!row) throw new Error("Completed document upload result is unavailable");
      return { documentId: row.document.id, documentVersionId: row.version.id, versionNumber: row.version.versionNumber, replayed: true };
    },
  });
  revalidatePath(`/tool/organizations/${params.organizationId}/documents`); revalidatePath(`/tool/organizations/${params.organizationId}/gap-analysis`);
  return { status: 201, data: { document: result.value, reused: result.reused } };
});
