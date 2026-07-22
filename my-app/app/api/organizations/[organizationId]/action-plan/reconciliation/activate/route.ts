import { revalidatePath } from "next/cache";
import { actionPlanReconciliationActivateSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/api/auth";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { activateActionPlanReconciliation, getActionPlanReconciliation } from "@/src/server/action-plans/reconciliation-service";
import { getActionPlanDetail } from "@/src/server/action-plans/service"; import { runIdempotentCommand } from "@/src/server/api/idempotency"; import { databaseIdempotencyRepository } from "@/src/server/idempotency/repository"; import { ApiError } from "@/src/server/api/errors";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const body = await readJsonBody(request, actionPlanReconciliationActivateSchema);
  const expectedVersion = requireIfMatch(request);
  const command = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, scope: organizationId,
    operation: "action-plan.activate", requestInput: { ...body, expectedVersion }, resultType: "action_plan_reconciliation", responseStatus: 200,
    execute: () => activateActionPlanReconciliation({ userId: user.id, organizationId, ...body, expectedVersion }), resultId: (value) => value.reconciliation.id,
    replay: async (id) => { const reconciliation = await getActionPlanReconciliation(user.id, organizationId, id); if (!reconciliation) throw new ApiError(409, "Activation result is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE"); const detail = await getActionPlanDetail(user.id, organizationId, reconciliation.reconciliation.targetPlanId); return { reconciliation: reconciliation.reconciliation, plan: detail.plan }; },
  });
  revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
  return { data: { result: command.value, reused: command.reused } };
});
