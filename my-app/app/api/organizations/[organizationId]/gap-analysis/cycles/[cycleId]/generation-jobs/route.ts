import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/i18n";
import { gapAnalysisGenerationJobSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { requireIdempotencyKey } from "@/src/server/api/idempotency";
import { readJsonBody } from "@/src/server/api/request";
import { enforceOperationRateLimit } from "@/src/server/api/operation-rate-limit";
import { enqueueGapAnalysisGeneration, retryGapAnalysisGeneration } from "@/src/server/gap-analysis";

export const POST = apiRoute(async ({ request, routeContext }: {
  request: Request;
  routeContext: { params: Promise<{ organizationId: string; cycleId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, cycleId } = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "gap:generate", scopeId: organizationId });
  const body = await readJsonBody(request, gapAnalysisGenerationJobSchema);
  const idempotencyKey = requireIdempotencyKey(request);
  const result = body.operation === "start"
    ? await enqueueGapAnalysisGeneration({ userId: user.id, organizationId, draftId: cycleId, locale: await getLocale(), idempotencyKey })
    : await retryGapAnalysisGeneration({ userId: user.id, organizationId, draftId: cycleId, retryNonce: body.retryNonce, idempotencyKey });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return {
    status: 202,
    data: {
      job: result.job,
      reused: result.reused,
    },
  };
});
