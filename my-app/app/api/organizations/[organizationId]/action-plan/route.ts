import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/i18n";
import { actionPlanGenerationRequestSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/api/auth";
import { formatEtag } from "@/src/server/api/concurrency";
import { apiRoute } from "@/src/server/api/handler";
import { claimIdempotency, completeIdempotency, failIdempotency, fingerprintRequest, requireIdempotencyKey } from "@/src/server/api/idempotency";
import { readJsonBody } from "@/src/server/api/request";
import { getCurrentActionPlan, getActionPlanDetail, generateActionPlan } from "@/src/server/action-plans/service";
import { databaseIdempotencyRepository } from "@/src/server/idempotency/repository";

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
    actorKey: user.id, scope: organizationId, operation: "action-plan.generate",
    key: requireIdempotencyKey(request), requestFingerprint: fingerprintRequest(body),
  });
  if (claim.kind === "replay" && claim.record.resultReference) {
    const detail = await getActionPlanDetail(user.id, organizationId, claim.record.resultReference.id);
    return { data: { plan: detail.plan, reused: true }, meta: { version: detail.plan.version } };
  }
  try {
    const plan = await generateActionPlan({ userId: user.id, organizationId, locale: await getLocale(), ...body });
    await completeIdempotency(databaseIdempotencyRepository, claim.record, { responseStatus: 201, resultReference: { type: "action_plan", id: plan.id } });
    revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
    return { status: 201, data: { plan, reused: false }, meta: { version: plan.version } };
  } catch (error) {
    await failIdempotency(databaseIdempotencyRepository, claim.record);
    throw error;
  }
});
