import { db } from "@/src/db";
import { actionPlanItems, actionPlans, auditEvents } from "@/src/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { getGapRevisionStaleness } from "@/src/server/gap-analysis";
import {
  assertCanAccessOrganization,
  assertCanContributeToOrganization,
} from "../organizations/service";

type PlanSourceFinding = {
  id: string;
  status:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence";
  severity: "low" | "medium" | "high" | "critical";
  requirementTitle: string;
  recommendation: string;
};

export function buildActionPlanItems(findings: PlanSourceFinding[]) {
  return findings
    .filter((finding) => finding.status !== "fulfilled")
    .map((finding) => ({
      sourceFindingId: finding.id,
      title: finding.requirementTitle,
      description: finding.recommendation,
      priority: finding.severity,
      status: "open" as const,
    }));
}

export async function getCurrentActionPlan(
  userId: string,
  organizationId: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  const plan = await db.query.actionPlans.findFirst({ columns: { id: true, organizationId: true, sourceGapArtifactRevisionId: true, outputLocale: true, status: true, revisionNumber: true, activatedBy: true, activatedAt: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true, version: true },
    where: { RAW: (table, operators) => (and(
      eq(table.organizationId, organizationId),
      eq(table.status, "active"),
    )) ?? operators.sql`true` },
    orderBy: { createdAt: "desc" },
  });
  if (!plan) return null;
  const items = await db.query.actionPlanItems.findMany({ columns: { id: true, actionPlanId: true, sourceFindingId: true, title: true, description: true, priority: true, status: true, ownerUserId: true, dueDate: true, createdAt: true, updatedAt: true, version: true },
    where: { RAW: (table, operators) => (eq(table.actionPlanId, plan.id)) ?? operators.sql`true` },
    orderBy: { priority: "desc", createdAt: "asc" },
  });
  const sourceStaleness = await getGapRevisionStaleness({
    userId,
    organizationId,
    revisionId: plan.sourceGapArtifactRevisionId,
  });
  return { plan, items, sourceStaleness };
}

export async function getActionPlanDetail(
  userId: string,
  organizationId: string,
  planId: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  const plan = await db.query.actionPlans.findFirst({ columns: { id: true, organizationId: true, sourceGapArtifactRevisionId: true, outputLocale: true, status: true, revisionNumber: true, activatedBy: true, activatedAt: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true, version: true },
    where: { RAW: (table, operators) => (and(
      eq(table.id, planId),
      eq(table.organizationId, organizationId),
    )) ?? operators.sql`true` },
  });
  if (!plan) {
    throw new ApiError(
      404,
      "Action plan not found",
      undefined,
      "ACTION_PLAN_NOT_FOUND",
    );
  }
  const items = await db.query.actionPlanItems.findMany({ columns: { id: true, actionPlanId: true, sourceFindingId: true, title: true, description: true, priority: true, status: true, ownerUserId: true, dueDate: true, createdAt: true, updatedAt: true, version: true },
    where: { RAW: (table, operators) => (eq(table.actionPlanId, plan.id)) ?? operators.sql`true` },
    orderBy: { priority: "desc", createdAt: "asc" },
  });
  return { plan, items };
}

export async function updateActionPlanItem(input: {
  userId: string;
  organizationId: string;
  itemId: string;
  status?: "open" | "in_progress" | "done" | "cancelled";
  ownerUserId?: string | null;
  dueDate?: string | null;
  expectedVersion: number;
}) {
  await assertCanContributeToOrganization(
    input.userId,
    input.organizationId,
  );
  const [current] = await db
    .select({ item: actionPlanItems, plan: actionPlans })
    .from(actionPlanItems)
    .innerJoin(
      actionPlans,
      eq(actionPlanItems.actionPlanId, actionPlans.id),
    )
    .where(
      and(
        eq(actionPlanItems.id, input.itemId),
        eq(actionPlans.organizationId, input.organizationId),
        eq(actionPlans.status, "active"),
      ),
    )
    .limit(1);
  if (!current) throw new ApiError(404, "Action-plan item not found");
  if (input.ownerUserId) {
    const owner = await db.query.organizationMemberships.findFirst({ columns: { id: true, organizationId: true, userId: true, role: true, status: true, version: true, createdAt: true, updatedAt: true },
      where: { RAW: (table, operators) => (and(
        eq(
          table.organizationId,
          input.organizationId,
        ),
        eq(table.userId, input.ownerUserId!),
        eq(table.status, "active"),
      )) ?? operators.sql`true` },
    });
    if (!owner) {
      throw new ApiError(
        400,
        "Item owner must be an active organization member",
      );
    }
  }
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    throw new ApiError(400, "dueDate must use YYYY-MM-DD");
  }
  const updatedAt = new Date();
  const changes = {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.ownerUserId !== undefined
      ? { ownerUserId: input.ownerUserId }
      : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    updatedAt,
  };
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(actionPlanItems)
      .set({
        ...changes,
        version: sql`${actionPlanItems.version} + 1`,
      })
      .where(
        and(
          eq(actionPlanItems.id, input.itemId),
          eq(actionPlanItems.version, input.expectedVersion),
        ),
      )
      .returning();
    if (!updated) {
      throw new ApiError(
        412,
        "The action-plan item changed",
        { currentVersion: current.item.version },
        "PRECONDITION_FAILED",
      );
    }
    const [lockedPlan] = await tx
      .update(actionPlans)
      .set({
        updatedAt,
        version: sql`${actionPlans.version} + 1`,
      })
      .where(
        and(
          eq(actionPlans.id, current.plan.id),
          eq(actionPlans.status, "active"),
        ),
      )
      .returning({ id: actionPlans.id });
    if (!lockedPlan) {
      throw new ApiError(
        409,
        "The action plan is no longer active",
        undefined,
        "ACTION_PLAN_NOT_ACTIVE",
      );
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "action_plan_item.updated",
      entityType: "action_plan_item",
      entityId: input.itemId,
      metadata: { before: current.item, changes },
    });
    return updated;
  });
}
