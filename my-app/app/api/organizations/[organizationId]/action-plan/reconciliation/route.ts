import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/i18n";
import { actionPlanReconciliationPrepareSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { getActionPlanReconciliation, prepareActionPlanReconciliation } from "@/src/server/action-plans/reconciliation-service";
import { runIdempotentCommand } from "@/src/server/api/idempotency"; import { databaseIdempotencyRepository } from "@/src/server/idempotency/repository"; import { ApiError } from "@/src/server/api/errors";
type Context = { params: Promise<{ organizationId: string }> };
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const reconciliation = await getActionPlanReconciliation(user.id, organizationId);
  return { data: { reconciliation }, ...(reconciliation ? { meta: { version: reconciliation.reconciliation.version } } : {}) };
});
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const body = await readJsonBody(request, actionPlanReconciliationPrepareSchema);
  const locale = await getLocale();
  const result = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, scope: organizationId,
    operation: "action-plan.reconcile", requestInput: body, resultType: "action_plan_reconciliation", responseStatus: 201,
    execute: async () => { const value = await prepareActionPlanReconciliation({ userId: user.id, organizationId, locale, ...body }); if (!value) throw new ApiError(500, "Could not prepare reconciliation", undefined, "RECONCILIATION_PREPARE_FAILED"); return value; },
    resultId: (value) => value.reconciliation.id,
    replay: async (id) => { const value = await getActionPlanReconciliation(user.id, organizationId, id); if (!value) throw new ApiError(409, "Reconciliation result is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE"); return value; },
  });
  revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
  return { status: 201, data: { reconciliation: result.value, reused: result.reused }, meta: { version: result.value.reconciliation.version } };
});
