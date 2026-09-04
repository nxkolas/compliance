import { revalidatePath } from "next/cache";
import { getLocale } from "@/src/i18n";
import { gapAnalysisGenerationJobSchema } from "@/src/contracts/gap-analysis/generation";
import type { JobDto } from "@/src/contracts/common/jobs";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { runIdempotentCommand } from "@/src/server/platform/http/idempotency";
import { readJsonBody } from "@/src/server/platform/http/request";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";
import { enqueueGapAnalysisGeneration, retryGapAnalysisGeneration } from "@/src/server/modules/gap-analysis";
import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";
import { getAuthorizedJob } from "@/src/server/platform/jobs";

export const POST = apiRoute(async ({ request, routeContext }: {
  request: Request;
  routeContext: { params: Promise<{ organizationId: string; cycleId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, cycleId } = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "gap:generate", scopeId: organizationId });
  const body = await readJsonBody(request, gapAnalysisGenerationJobSchema);
  const locale = body.operation === "start" ? await getLocale() : undefined;
  const result = await runIdempotentCommand<{ job: JobDto; reused: boolean }>({
    repository: databaseIdempotencyRepository,
    request,
    actorKey: user.id,
    organizationId,
    scope: organizationId,
    operation: body.operation === "start" ? "gap.generate" : "gap.retry",
    requestInput: { cycleId, ...(locale ? { locale } : {}), ...body },
    resultType: "background_job",
    responseStatus: 202,
    execute: async () => body.operation === "start"
      ? enqueueGapAnalysisGeneration({ userId: user.id, organizationId, draftId: cycleId, locale: locale!, idempotencyKey: request.headers.get("idempotency-key")! })
      : retryGapAnalysisGeneration({ userId: user.id, organizationId, draftId: cycleId, retryNonce: body.retryNonce, idempotencyKey: request.headers.get("idempotency-key")! }),
    resultId: (value) => value.job.id,
    replay: async (jobId) => ({ job: await getAuthorizedJob(user.id, jobId), reused: true }),
  });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return {
    status: 202,
    data: {
      job: result.value.job,
      reused: result.reused || result.value.reused,
    },
  };
});
