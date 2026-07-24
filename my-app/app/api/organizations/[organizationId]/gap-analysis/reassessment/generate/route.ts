import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/i18n";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { requireIdempotencyKey } from "@/src/server/api/idempotency";
import { readJsonBody } from "@/src/server/api/request";
import { generateGapReassessment } from "@/src/server/gap-analysis/reassessment-service";
import { gapReassessmentGenerateSchema } from "@/src/contracts/gap-analysis/generation";
import { enforceOperationRateLimit } from "@/src/server/api/operation-rate-limit";

export const POST = apiRoute(async ({ request, routeContext }: {
  request: Request;
  routeContext: { params: Promise<{ organizationId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "gap:generate", scopeId: organizationId });
  const body = await readJsonBody(request, gapReassessmentGenerateSchema);
  const result = await generateGapReassessment({
    userId: user.id,
    organizationId,
    locale: await getLocale(),
    idempotencyKey: requireIdempotencyKey(request),
    ...body,
  });
  revalidatePath(`/tool/organizations/${organizationId}/documents`);
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return {
    status: 202,
    data: {
      draft: {
        id: result.draft.id,
        status: result.draft.status,
        outputLocale: result.draft.outputLocale,
        lockVersion: result.draft.lockVersion,
        generationJobId: result.draft.generationJobId!,
        aiProcessingRunId: result.draft.aiProcessingRunId,
        outputGapRevisionId: result.draft.outputGapRevisionId,
      },
      job: result.job,
      reused: result.reused,
    },
  };
});
