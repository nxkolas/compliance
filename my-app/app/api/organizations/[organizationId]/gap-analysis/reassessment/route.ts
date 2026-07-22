import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/i18n";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { getGapReassessmentDraft, prepareGapReassessment } from "@/src/server/gap-analysis/reassessment-service";
import { gapReassessmentPrepareSchema, gapReassessmentQuerySchema } from "@/src/contracts/gap-analysis/generation";
import { runIdempotentCommand } from "@/src/server/api/idempotency"; import { databaseIdempotencyRepository } from "@/src/server/idempotency/repository";
import { parseInput } from "@/src/server/api/request";
type Context = { params: Promise<{ organizationId: string }> };
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const { assessmentId } = parseInput(gapReassessmentQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  return { data: { reassessment: await getGapReassessmentDraft({ userId: user.id, organizationId, assessmentId, locale: await getLocale() }) } };
});
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const body = await readJsonBody(request, gapReassessmentPrepareSchema); const locale = await getLocale();
  const result = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, scope: organizationId,
    operation: "gap-reassessment.prepare", requestInput: body, resultType: "gap_reassessment_draft", responseStatus: 201,
    execute: async () => { const value = await prepareGapReassessment({ userId: user.id, organizationId, locale, ...body }); if (!value) throw new ApiError(500, "Could not prepare reassessment", undefined, "GAP_REASSESSMENT_PREPARE_FAILED"); return value; },
    resultId: (value) => value.draft.id,
    replay: async (id) => { const value = await getGapReassessmentDraft({ userId: user.id, organizationId, draftId: id, locale }); if (!value) throw new ApiError(409, "Reassessment result is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE"); return value; },
  });
  revalidatePath(`/tool/organizations/${organizationId}/documents`); revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { status: 201, data: { reassessment: result.value, reused: result.reused } };
});
