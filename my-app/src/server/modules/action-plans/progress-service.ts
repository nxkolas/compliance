import { actionPlanItemStatuses } from "@/src/contracts/action-plans";
import { actionPlanItems } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { authorizeOrganizationRead } from "../../platform/auth/organization-scope";

export async function getActionPlanProgress(
  userId: string,
  organizationId: string,
) {
  const scope = await authorizeOrganizationRead({
    actorUserId: userId,
    organizationId,
    capability: "plans:read",
  });
  const plan = await scope.executor.query.actionPlans.findFirst({
    columns: { id: true },
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, organizationId) ?? operators.sql`true`,
    },
  });
  const statuses = Object.fromEntries(
    actionPlanItemStatuses.map((status) => [status, 0]),
  ) as Record<(typeof actionPlanItemStatuses)[number], number>;

  if (!plan) return { planId: null, totalCount: 0, statuses };

  const items = await scope.executor
    .select({ status: actionPlanItems.status })
    .from(actionPlanItems)
    .where(eq(actionPlanItems.actionPlanId, plan.id));
  for (const item of items) statuses[item.status] += 1;

  return {
    planId: plan.id,
    totalCount: items.length,
    statuses,
  };
}
