import { revalidatePath } from "next/cache";
import { getLocale } from "@/src/i18n";
import { gapAnalysisCyclePrepareSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { ApiError } from "@/src/server/platform/http/errors";
import { apiRoute } from "@/src/server/platform/http/handler";
import { runIdempotentCommand } from "@/src/server/platform/http/idempotency";
import { readJsonBody } from "@/src/server/platform/http/request";
import { getGapAnalysisCycle, prepareGapAnalysisCycle } from "@/src/server/modules/gap-analysis";
import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";

export const POST = apiRoute(async ({ request, routeContext }: {
  request: Request;
  routeContext: { params: Promise<{ organizationId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const body = await readJsonBody(request, gapAnalysisCyclePrepareSchema);
  const locale = await getLocale();
  const result = await runIdempotentCommand({
    repository: databaseIdempotencyRepository,
    request,
    actorKey: user.id,
    organizationId,
    scope: organizationId,
    operation: "gap-analysis-cycle.prepare",
    requestInput: body,
    resultType: "gap_analysis_cycle",
    responseStatus: 201,
    execute: async () => {
      const cycle = await prepareGapAnalysisCycle({ userId: user.id, organizationId, locale, ...body });
      if (!cycle) throw new ApiError(500, "Could not prepare analysis cycle", undefined, "GAP_REASSESSMENT_PREPARE_FAILED");
      return cycle;
    },
    resultId: (value) => value.draft.id,
    replay: async (cycleId) => {
      const cycle = await getGapAnalysisCycle({ userId: user.id, organizationId, draftId: cycleId, locale });
      if (!cycle) throw new ApiError(409, "Analysis cycle is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE");
      return cycle;
    },
  });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { status: 201, data: { analysisCycle: result.value, reused: result.reused } };
});
