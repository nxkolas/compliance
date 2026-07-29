import { db } from "@/src/db";
import {
  actionPlanItems,
  actionPlans,
  auditEvents,
} from "@/src/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  assertCanAccessOrganization,
  assertCanContributeToOrganization,
} from "../organizations/service";
import {
  getGapRevisionStaleness,
  loadGapAnalysisRelease,
} from "../gap-analysis";

const planColumns = {
  id: true,
  organizationId: true,
  sourceGapArtifactRevisionId: true,
  outputLocale: true,
  generationRunId: true,
  generationJobId: true,
  status: true,
  revisionNumber: true,
  activatedBy: true,
  activatedAt: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  version: true,
} as const;

const itemColumns = {
  id: true,
  actionPlanId: true,
  sourceFindingId: true,
  title: true,
  result: true,
  suggestedEvidence: true,
  position: true,
  executionNotes: true,
  priority: true,
  status: true,
  ownerUserId: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  version: true,
} as const;

export async function getCurrentActionPlan(
  userId: string,
  organizationId: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  const plan = await db.query.actionPlans.findFirst({
    columns: planColumns,
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, organizationId),
          eq(table.status, "active"),
        ) ?? operators.sql`true`,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!plan) return null;
  const categories = await loadGroupedItems(plan);
  const sourceStaleness = await getGapRevisionStaleness({
    userId,
    organizationId,
    revisionId: plan.sourceGapArtifactRevisionId,
  });
  return { plan, categories, sourceStaleness };
}

export async function getActionPlanDetail(
  userId: string,
  organizationId: string,
  planId: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  const plan = await db.query.actionPlans.findFirst({
    columns: planColumns,
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, planId),
          eq(table.organizationId, organizationId),
        ) ?? operators.sql`true`,
    },
  });
  if (!plan) {
    throw new ApiError(
      404,
      "Action plan not found",
      undefined,
      "ACTION_PLAN_NOT_FOUND",
    );
  }
  return { plan, categories: await loadGroupedItems(plan) };
}

async function loadGroupedItems(plan: {
  id: string;
  sourceGapArtifactRevisionId: string;
  outputLocale: string;
}) {
  if (plan.outputLocale !== "de" && plan.outputLocale !== "en") {
    throw new ApiError(
      409,
      "Action Plan locale is invalid",
      undefined,
      "GAP_OUTPUT_LOCALE_INVALID",
    );
  }
  const revision =
    await db.query.generatedArtifactRevisions.findFirst({
      columns: { gapAnalysisReleaseId: true },
      where: {
        RAW: (table, operators) =>
          eq(table.id, plan.sourceGapArtifactRevisionId) ??
          operators.sql`true`,
      },
    });
  if (!revision?.gapAnalysisReleaseId) {
    throw new ApiError(
      409,
      "Action Plan source release is unavailable",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  const release = await loadGapAnalysisRelease(
    revision.gapAnalysisReleaseId,
    plan.outputLocale,
  );
  if (!release) {
    throw new ApiError(
      409,
      "Action Plan source release is unavailable",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  const items = await db.query.actionPlanItems.findMany({
    columns: itemColumns,
    where: {
      RAW: (table, operators) =>
        eq(table.actionPlanId, plan.id) ?? operators.sql`true`,
    },
  });
  const findings = items.length
    ? await db.query.gapFindings.findMany({
        columns: { id: true, requirementVersionId: true },
        where: {
          RAW: (table, operators) =>
            inArray(
              table.id,
              items.map((item) => item.sourceFindingId),
            ) ?? operators.sql`true`,
        },
      })
    : [];
  const findingById = new Map(
    findings.map((finding) => [finding.id, finding]),
  );
  return release.requirements
    .map((requirement) => ({
      requirementVersionId: requirement.id,
      title: requirement.title,
      position: requirement.position,
      actions: items
        .filter(
          (item) =>
            findingById.get(item.sourceFindingId)
              ?.requirementVersionId === requirement.id,
        )
        .sort((left, right) => left.position - right.position),
    }))
    .filter((category) => category.actions.length > 0)
    .sort((left, right) => left.position - right.position);
}

export async function updateActionPlanItem(input: {
  userId: string;
  organizationId: string;
  itemId: string;
  status: "open" | "in_progress" | "done" | "cancelled";
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
  const updatedAt = new Date();
  const changes = {
    status: input.status,
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
