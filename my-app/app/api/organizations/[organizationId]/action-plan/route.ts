import { revalidatePath } from "next/cache";
import { actionPlanGenerationRequestSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/api/auth";
import { formatEtag } from "@/src/server/api/concurrency";
import { apiRoute } from "@/src/server/api/handler";
import { claimIdempotency, failIdempotency, fingerprintRequest, requireIdempotencyKey } from "@/src/server/api/idempotency";
import { readJsonBody } from "@/src/server/api/request";
import { getCurrentActionPlan, getActionPlanDetail } from "@/src/server/action-plans";
import { finalizeGapAnalysisAndGenerateActionPlan } from "@/src/server/gap-analysis";
import { databaseIdempotencyRepository } from "@/src/server/idempotency";

type Context = { params: Promise<{ organizationId: string }> };
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const current = await getCurrentActionPlan(user.id, organizationId);
  return { data: { current }, ...(current ? { meta: { version: current.plan.version }, headers: { etag: formatEtag(current.plan.version) } } : {}) };
});
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const body = await readJsonBody(request, actionPlanGenerationRequestSchema);
  const claim = await claimIdempotency(databaseIdempotencyRepository, {
    actorKey: user.id, organizationId, scope: organizationId, operation: "action-plan.generate",
    key: requireIdempotencyKey(request), requestFingerprint: fingerprintRequest(body),
  });
  if (claim.kind === "replay" && claim.record.resultReference) {
    const detail = await getActionPlanDetail(user.id, organizationId, claim.record.resultReference.id);
    return { data: { plan: detail.plan, reused: true }, meta: { version: detail.plan.version } };
  }
  try {
    const { plan } = await finalizeGapAnalysisAndGenerateActionPlan({
      userId: user.id,
      organizationId,
      gapRevisionId: body.gapRevisionId,
      command: claim.record,
    });
    revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return { status: 201, data: { plan, reused: false }, meta: { version: plan.version } };
  } catch (error) {
    await failIdempotency(databaseIdempotencyRepository, claim.record);
    throw error;
  }
});
