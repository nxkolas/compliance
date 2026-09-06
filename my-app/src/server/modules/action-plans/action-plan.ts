import {
  actionPlanItemGaps,
  actionPlanItems,
  actionPlans,
  auditEvents,
  gapFindings,
  gapItems,
} from "@/src/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand, type OrganizationScopeExecutor } from "../../platform/auth/organization-scope";

type ActionPriority = "low" | "medium" | "high" | "critical";

export async function getCurrentActionPlan(userId: string, organizationId: string) {
  const scope = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "plans:read" });
  const plan = await scope.executor.query.actionPlans.findFirst({
    where: { RAW: (table, operators) => eq(table.organizationId, organizationId) ?? operators.sql`true` },
  });
  if (!plan) return null;
  return loadBundle(plan, scope.executor);
}

export async function updateActionPlanItem(input: {
  userId: string;
  organizationId: string;
  itemId: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  expectedVersion?: number;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "plans:contribute" }, async ({ executor }) => {
    const [item] = await executor.update(actionPlanItems).set({ status: input.status, updatedAt: new Date() })
      .where(and(eq(actionPlanItems.id, input.itemId), eq(actionPlanItems.organizationId, input.organizationId))).returning();
    if (!item) throw new ApiError(404, "Action Plan item not found");
    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "action_plan_item.status_changed",
      entityType: "action_plan_item",
      entityId: item.id,
      metadata: { status: item.status },
    });
    return item;
  });
}

async function loadBundle(plan: typeof actionPlans.$inferSelect, executor: OrganizationScopeExecutor) {
  const items = await executor.select().from(actionPlanItems)
    .where(eq(actionPlanItems.actionPlanId, plan.id)).orderBy(asc(actionPlanItems.position));
  const findingIds = [...new Set(items.map((item) => item.findingId))];
  const findings = findingIds.length ? await executor.select().from(gapFindings).where(inArray(gapFindings.id, findingIds)) : [];
  const links = items.length ? await executor.select().from(actionPlanItemGaps).where(inArray(actionPlanItemGaps.actionPlanItemId, items.map((item) => item.id))) : [];
  const gapIds = [...new Set(links.map((link) => link.gapItemId))];
  const gaps = gapIds.length ? await executor.select().from(gapItems).where(inArray(gapItems.id, gapIds)) : [];
  const currentGap = await executor.query.analysisOutputs.findFirst({
    columns: { currentRevisionId: true },
    where: { RAW: (table, operators) => and(eq(table.organizationId, plan.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
  });
  const categories = findings.sort((a, b) => a.position - b.position).map((finding) => ({
    requirementVersionId: finding.requirementKey,
    title: finding.requirementTitle,
    icon: finding.icon,
    position: finding.position,
    actions: items.filter((item) => item.findingId === finding.id).map((item) => ({
      ...item,
      priority: actionPriority(finding.criticality),
      gaps: links.filter((link) => link.actionPlanItemId === item.id).map((link) => gaps.find((gap) => gap.id === link.gapItemId)).filter(Boolean),
    })),
  })).filter((category) => category.actions.length);
  return {
    plan,
    items,
    categories,
    sourceStaleness: { stale: currentGap?.currentRevisionId !== plan.sourceGapRevisionId },
  };
}

function actionPriority(value: string): ActionPriority {
  return value === "low" || value === "high" || value === "critical"
    ? value
    : "medium";
}
