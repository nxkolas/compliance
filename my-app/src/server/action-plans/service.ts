import { db } from "@/src/db";
import {
  actionPlanItems,
  actionPlans,
  auditEvents,
  gapFindings,
  gapRequirementVersions,
  generatedArtifactRevisions,
  generatedArtifacts,
  organizationMemberships,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import * as z from "zod";
import { ApiError } from "../api/errors";
import { getGapRevisionStaleness } from "../gap-analysis/staleness";
import {
  assertCanAccessOrganization,
  assertCanContributeToOrganization,
  assertCanManageOrganization,
} from "../organizations/service";
import { getCursorCodec } from "../api/pagination";

type PlanSourceFinding = {
  id: string;
  status: "fulfilled" | "partially_fulfilled" | "not_fulfilled" | "insufficient_evidence";
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

export async function generateActionPlan(input: {
  userId: string;
  organizationId: string;
  approvedGapRevisionId: string;
  locale: Locale;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const revision = await db.query.generatedArtifactRevisions.findFirst({
    where: and(
      eq(generatedArtifactRevisions.id, input.approvedGapRevisionId),
      eq(generatedArtifactRevisions.status, "approved"),
    ),
  });
  if (!revision) throw new ApiError(409, "An approved gap revision is required");
  const artifact = await db.query.generatedArtifacts.findFirst({
    where: and(
      eq(generatedArtifacts.id, revision.artifactId),
      eq(generatedArtifacts.organizationId, input.organizationId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ),
  });
  if (!artifact || artifact.acceptedRevisionId !== revision.id) {
    throw new ApiError(409, "The approved gap revision is not accepted");
  }
  const currentPlan = await db.query.actionPlans.findFirst({
    where: and(
      eq(actionPlans.organizationId, input.organizationId),
      eq(actionPlans.status, "active"),
    ),
    orderBy: [desc(actionPlans.createdAt)],
  });
  if (currentPlan?.sourceGapArtifactRevisionId === revision.id) {
    return currentPlan;
  }
  if (currentPlan) {
    throw new ApiError(409, "Prepare a reconciliation to update the active plan");
  }
  const findings = await db.query.gapFindings.findMany({
    where: eq(gapFindings.artifactRevisionId, revision.id),
  });
  const requirements = findings.length
    ? await db.query.gapRequirementVersions.findMany({
        where: inArray(
          gapRequirementVersions.id,
          findings.map((finding) => finding.requirementVersionId),
        ),
      })
    : [];
  const requirementById = new Map(requirements.map((item) => [item.id, item]));
  const baseline = buildActionPlanItems(
    findings.map((finding) => {
      const requirement = requirementById.get(finding.requirementVersionId);
      if (!requirement) throw new ApiError(409, "Pinned requirement is missing");
      return {
        id: finding.id,
        status: finding.status,
        severity: finding.severity,
        requirementTitle: localize(requirement.title, input.locale),
        recommendation: localize(finding.recommendation, input.locale),
      };
    }),
  );
  const latestPlan = await db.query.actionPlans.findFirst({
    where: eq(actionPlans.organizationId, input.organizationId),
    orderBy: [desc(actionPlans.revisionNumber)],
  });
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(actionPlans)
      .values({
        organizationId: input.organizationId,
        sourceGapArtifactRevisionId: revision.id,
        revisionNumber: (latestPlan?.revisionNumber ?? 0) + 1,
        activatedBy: input.userId,
        activatedAt: new Date(),
        createdBy: input.userId,
      })
      .returning();
    if (!plan) throw new ApiError(500, "Could not create action plan");
    if (baseline.length > 0) {
      await tx.insert(actionPlanItems).values(
        baseline.map((item) => ({ ...item, actionPlanId: plan.id })),
      );
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "action_plan.generated",
      entityType: "action_plan",
      entityId: plan.id,
      metadata: { sourceGapArtifactRevisionId: revision.id, itemCount: baseline.length },
    });
    return plan;
  });
}

export async function getCurrentActionPlan(
  userId: string,
  organizationId: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  const plan = await db.query.actionPlans.findFirst({
    where: and(
      eq(actionPlans.organizationId, organizationId),
      eq(actionPlans.status, "active"),
    ),
    orderBy: [desc(actionPlans.createdAt)],
  });
  if (!plan) return null;
  const items = await db.query.actionPlanItems.findMany({
    where: eq(actionPlanItems.actionPlanId, plan.id),
    orderBy: [desc(actionPlanItems.priority), actionPlanItems.createdAt],
  });
  const sourceStaleness = await getGapRevisionStaleness({
    userId,
    organizationId,
    revisionId: plan.sourceGapArtifactRevisionId,
  });
  return {
    plan,
    items,
    sourceStaleness,
  };
}

export async function getCurrentApprovedGapRevision(
  userId: string,
  organizationId: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  const rows = await db
    .select({ revision: generatedArtifactRevisions })
    .from(generatedArtifacts)
    .innerJoin(
      generatedArtifactRevisions,
      eq(generatedArtifacts.acceptedRevisionId, generatedArtifactRevisions.id),
    )
    .where(
      and(
        eq(generatedArtifacts.organizationId, organizationId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
        eq(generatedArtifactRevisions.status, "approved"),
      ),
    )
    .limit(1);
  return rows[0]?.revision ?? null;
}

export async function getActionPlanHistory(
  userId: string,
  organizationId: string,
) {
  return (await getActionPlanHistoryPage({ userId, organizationId, limit: 50 })).plans;
}

const actionPlanCursorSchema = z.tuple([z.number().int().nonnegative(), z.uuid()]);
export async function getActionPlanHistoryPage(input: { userId: string; organizationId: string; limit: number; cursor?: string }) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  const scope = `action-plan-history:${input.organizationId}`;
  const cursor = input.cursor ? actionPlanCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const plans = await db.query.actionPlans.findMany({
    where: and(
      eq(actionPlans.organizationId, input.organizationId),
      inArray(actionPlans.status, ["superseded", "archived"]),
      cursor ? or(lt(actionPlans.revisionNumber, cursor[0]), and(eq(actionPlans.revisionNumber, cursor[0]), lt(actionPlans.id, cursor[1]))) : undefined,
    ),
    orderBy: [desc(actionPlans.revisionNumber), desc(actionPlans.id)],
    limit: input.limit + 1,
  });
  const page = plans.slice(0, input.limit);
  if (!page.length) return { plans: [], nextCursor: undefined };
  const items = await db.query.actionPlanItems.findMany({
    where: inArray(
      actionPlanItems.actionPlanId,
      page.map((plan) => plan.id),
    ),
  });
  const result = page.map((plan) => ({
    plan,
    items: items.filter((item) => item.actionPlanId === plan.id),
  }));
  const last = page.at(-1);
  return { plans: result, nextCursor: plans.length > input.limit && last ? getCursorCodec().encode(scope, [last.revisionNumber, last.id]) : undefined };
}

export async function getActionPlanDetail(
  userId: string,
  organizationId: string,
  planId: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  const plan = await db.query.actionPlans.findFirst({
    where: and(eq(actionPlans.id, planId), eq(actionPlans.organizationId, organizationId)),
  });
  if (!plan) throw new ApiError(404, "Action plan not found", undefined, "ACTION_PLAN_NOT_FOUND");
  const items = await db.query.actionPlanItems.findMany({
    where: eq(actionPlanItems.actionPlanId, plan.id),
    orderBy: [desc(actionPlanItems.priority), actionPlanItems.createdAt],
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
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const row = await db
    .select({ item: actionPlanItems, plan: actionPlans })
    .from(actionPlanItems)
    .innerJoin(actionPlans, eq(actionPlanItems.actionPlanId, actionPlans.id))
    .where(
      and(
        eq(actionPlanItems.id, input.itemId),
        eq(actionPlans.organizationId, input.organizationId),
        eq(actionPlans.status, "active"),
      ),
    )
    .limit(1);
  const current = row[0];
  if (!current) throw new ApiError(404, "Action-plan item not found");
  if (input.ownerUserId) {
    const owner = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.organizationId, input.organizationId),
        eq(organizationMemberships.userId, input.ownerUserId),
        eq(organizationMemberships.status, "active"),
      ),
    });
    if (!owner) throw new ApiError(400, "Item owner must be an active organization member");
  }
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    throw new ApiError(400, "dueDate must use YYYY-MM-DD");
  }
  const updatedAt = new Date();
  const changes = {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    updatedAt,
  };
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(actionPlanItems)
      .set({ ...changes, version: sql`${actionPlanItems.version} + 1` })
      .where(
        and(
          eq(actionPlanItems.id, input.itemId),
          eq(actionPlanItems.version, input.expectedVersion),
        ),
      )
      .returning();
    if (!updated) {
      throw new ApiError(412, "The action-plan item changed", { currentVersion: current.item.version }, "PRECONDITION_FAILED");
    }
    const [lockedPlan] = await tx
      .update(actionPlans)
      .set({ updatedAt, version: sql`${actionPlans.version} + 1` })
      .where(and(eq(actionPlans.id, current.plan.id), eq(actionPlans.status, "active")))
      .returning({ id: actionPlans.id });
    if (!lockedPlan) throw new ApiError(409, "The action plan is no longer active", undefined, "ACTION_PLAN_NOT_ACTIVE");
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

function localize(value: unknown, locale: Locale) {
  const candidate = value as { de?: unknown; en?: unknown };
  const localized = candidate[locale] ?? candidate.de ?? candidate.en;
  return typeof localized === "string" ? localized : "";
}
