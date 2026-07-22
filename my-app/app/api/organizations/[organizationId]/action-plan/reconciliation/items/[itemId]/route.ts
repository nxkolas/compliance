import { revalidatePath } from "next/cache";
import { actionPlanReconciliationDecisionSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/api/auth";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { decideActionPlanReconciliationItem } from "@/src/server/action-plans/reconciliation-service";
export const PATCH = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; itemId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const body = await readJsonBody(request, actionPlanReconciliationDecisionSchema);
  const reconciliation = await decideActionPlanReconciliationItem({ userId: user.id, organizationId: params.organizationId, itemReconciliationId: params.itemId, ...body, expectedVersion: requireIfMatch(request) });
  revalidatePath(`/tool/organizations/${params.organizationId}/action-plan`);
  return { data: { reconciliation }, meta: { version: reconciliation!.reconciliation.version } };
});
