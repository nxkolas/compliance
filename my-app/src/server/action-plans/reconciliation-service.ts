import { db } from "@/src/db";
import {
  actionPlanItemReconciliations,
  actionPlanItems,
  actionPlanReconciliations,
  actionPlans,
  auditEvents,
  gapFindingEvidence,
  gapFindings,
  gapRequirementVersions,
  generatedArtifactRevisions,
  generatedArtifacts,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  assertCanAccessOrganization,
  assertCanManageOrganization,
} from "../organizations/service";
import {
  allowedReconciliationDecisions,
  reconcileActionPlanItems,
  requiresReconciliationDecision,
  type ReconciliationDecision,
} from "./reconciliation";

export async function prepareActionPlanReconciliation(input: {
  userId: string;
  organizationId: string;
  targetGapRevisionId: string;
  locale: Locale;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const accepted = await db
    .select({ revision: generatedArtifactRevisions, artifact: generatedArtifacts })
    .from(generatedArtifactRevisions)
    .innerJoin(
      generatedArtifacts,
      eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id),
    )
    .where(
      and(
        eq(generatedArtifactRevisions.id, input.targetGapRevisionId),
        eq(generatedArtifactRevisions.status, "approved"),
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
        eq(generatedArtifacts.acceptedRevisionId, input.targetGapRevisionId),
      ),
    )
    .limit(1);
  if (!accepted[0]) throw new ApiError(409, "The target gap revision is not accepted");
  const sourcePlan = await db.query.actionPlans.findFirst({
    where: and(
      eq(actionPlans.organizationId, input.organizationId),
      eq(actionPlans.status, "active"),
    ),
  });
  if (!sourcePlan) throw new ApiError(409, "An active plan is required for reconciliation");
  if (sourcePlan.sourceGapArtifactRevisionId === input.targetGapRevisionId) {
    throw new ApiError(409, "The active plan already uses the accepted gap revision");
  }
  const existing = await db.query.actionPlanReconciliations.findFirst({
    where: and(
      eq(actionPlanReconciliations.organizationId, input.organizationId),
      eq(actionPlanReconciliations.targetGapRevisionId, input.targetGapRevisionId),
      inArray(actionPlanReconciliations.status, ["draft", "ready"]),
    ),
  });
  if (
    existing &&
    existing.sourcePlanId === sourcePlan.id &&
    existing.sourcePlanUpdatedAt.getTime() === sourcePlan.updatedAt.getTime()
  ) {
    return getActionPlanReconciliation(input.userId, input.organizationId, existing.id);
  }
  if (existing) {
    await db.transaction(async (tx) => {
      const [cancelled] = await tx
        .update(actionPlanReconciliations)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(actionPlanReconciliations.id, existing.id),
            inArray(actionPlanReconciliations.status, ["draft", "ready"]),
          ),
        )
        .returning();
      if (!cancelled) {
        throw new ApiError(409, "Reconciliation changed before it could be recomputed");
      }
      await tx.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "action_plan_reconciliation.cancelled",
        entityType: "action_plan_reconciliation",
        entityId: existing.id,
        metadata: { reason: "source_plan_changed" },
      });
    });
  }

  const previousRows = await db
    .select({
      item: actionPlanItems,
      finding: gapFindings,
      requirement: gapRequirementVersions,
    })
    .from(actionPlanItems)
    .innerJoin(gapFindings, eq(actionPlanItems.sourceFindingId, gapFindings.id))
    .innerJoin(
      gapRequirementVersions,
      eq(gapFindings.requirementVersionId, gapRequirementVersions.id),
    )
    .where(eq(actionPlanItems.actionPlanId, sourcePlan.id));
  const targetRows = await db
    .select({ finding: gapFindings, requirement: gapRequirementVersions })
    .from(gapFindings)
    .innerJoin(
      gapRequirementVersions,
      eq(gapFindings.requirementVersionId, gapRequirementVersions.id),
    )
    .where(eq(gapFindings.artifactRevisionId, input.targetGapRevisionId));
  const proposals = reconcileActionPlanItems({
    previousItems: previousRows.map((row) => ({
      itemId: row.item.id,
      findingId: row.finding.id,
      stableRequirementId: row.requirement.requirementId,
      requirementVersionId: row.requirement.id,
      status: row.item.status,
    })),
    targetFindings: targetRows.map((row) => ({
      findingId: row.finding.id,
      stableRequirementId: row.requirement.requirementId,
      requirementVersionId: row.requirement.id,
      status: row.finding.status,
    })),
  });
  const previousById = new Map(previousRows.map((row) => [row.item.id, row]));
  const targetById = new Map(targetRows.map((row) => [row.finding.id, row]));
  const latestPlan = await db.query.actionPlans.findFirst({
    where: eq(actionPlans.organizationId, input.organizationId),
    orderBy: [desc(actionPlans.revisionNumber)],
  });

  const reconciliationId = await db.transaction(async (tx) => {
    const [targetPlan] = await tx
      .insert(actionPlans)
      .values({
        organizationId: input.organizationId,
        sourceGapArtifactRevisionId: input.targetGapRevisionId,
        status: "draft_reconciliation",
        revisionNumber: (latestPlan?.revisionNumber ?? 0) + 1,
        predecessorPlanId: sourcePlan.id,
        createdBy: input.userId,
      })
      .returning();
    if (!targetPlan) throw new ApiError(500, "Could not create reconciled plan draft");
    const [reconciliation] = await tx
      .insert(actionPlanReconciliations)
      .values({
        organizationId: input.organizationId,
        sourcePlanId: sourcePlan.id,
        targetPlanId: targetPlan.id,
        sourceGapRevisionId: sourcePlan.sourceGapArtifactRevisionId,
        targetGapRevisionId: input.targetGapRevisionId,
        sourcePlanUpdatedAt: sourcePlan.updatedAt,
        status: proposals.every((proposal) => !proposal.requiresDecision)
          ? "ready"
          : "draft",
        createdBy: input.userId,
      })
      .returning();
    if (!reconciliation) throw new ApiError(500, "Could not create reconciliation");

    for (const proposal of proposals) {
      const previous = proposal.previousItemId
        ? previousById.get(proposal.previousItemId)
        : undefined;
      const target = proposal.targetFindingId
        ? targetById.get(proposal.targetFindingId)
        : undefined;
      const sourceFindingId = target?.finding.id ?? previous?.finding.id;
      if (!sourceFindingId) throw new ApiError(409, "Reconciliation source is missing");
      const [targetItem] = await tx
        .insert(actionPlanItems)
        .values({
          actionPlanId: targetPlan.id,
          sourceFindingId,
          title: target
            ? localize(target.requirement.title, input.locale)
            : previous!.item.title,
          description: target
            ? localize(target.finding.recommendation, input.locale)
            : previous!.item.description,
          priority: target?.finding.severity ?? previous!.item.priority,
          status:
            proposal.carryOperationalFields && previous
              ? previous.item.status
              : "open",
          ownerUserId:
            proposal.carryOperationalFields && previous
              ? previous.item.ownerUserId
              : null,
          dueDate:
            proposal.carryOperationalFields && previous
              ? previous.item.dueDate
              : null,
          predecessorItemId: previous?.item.id,
        })
        .returning();
      if (!targetItem) throw new ApiError(500, "Could not create reconciled item");
      await tx.insert(actionPlanItemReconciliations).values({
        reconciliationId: reconciliation.id,
        stableRequirementId: proposal.stableRequirementId,
        previousItemId: proposal.previousItemId,
        targetItemId: targetItem.id,
        previousFindingId: proposal.previousFindingId,
        targetFindingId: proposal.targetFindingId,
        changeKind: proposal.changeKind,
        proposedDecision: proposal.proposedDecision,
        decidedDecision: proposal.requiresDecision
          ? null
          : proposal.proposedDecision,
      });
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "action_plan_reconciliation.prepared",
      entityType: "action_plan_reconciliation",
      entityId: reconciliation.id,
      metadata: {
        sourcePlanId: sourcePlan.id,
        targetPlanId: targetPlan.id,
        targetGapRevisionId: input.targetGapRevisionId,
        itemCount: proposals.length,
      },
    });
    return reconciliation.id;
  });
  return getActionPlanReconciliation(
    input.userId,
    input.organizationId,
    reconciliationId,
  );
}

export async function getActionPlanReconciliation(
  userId: string,
  organizationId: string,
  reconciliationId?: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  const reconciliation = await db.query.actionPlanReconciliations.findFirst({
    where: and(
      eq(actionPlanReconciliations.organizationId, organizationId),
      ...(reconciliationId
        ? [eq(actionPlanReconciliations.id, reconciliationId)]
        : []),
    ),
    orderBy: [desc(actionPlanReconciliations.createdAt)],
  });
  if (!reconciliation) return null;
  const records = await db.query.actionPlanItemReconciliations.findMany({
    where: eq(
      actionPlanItemReconciliations.reconciliationId,
      reconciliation.id,
    ),
  });
  const itemIds = records.flatMap((record) =>
    [record.previousItemId, record.targetItemId].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const items = itemIds.length
    ? await db.query.actionPlanItems.findMany({
        where: inArray(actionPlanItems.id, itemIds),
      })
    : [];
  const findingIds = records.flatMap((record) =>
    [record.previousFindingId, record.targetFindingId].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const findings = findingIds.length
    ? await db.query.gapFindings.findMany({
        where: inArray(gapFindings.id, findingIds),
      })
    : [];
  const evidence = findingIds.length
    ? await db.query.gapFindingEvidence.findMany({
        where: inArray(gapFindingEvidence.findingId, findingIds),
      })
    : [];
  return {
    reconciliation,
    records: records.map((record) => ({
      ...record,
      requiresDecision: requiresReconciliationDecision(record.changeKind),
      allowedDecisions: record.proposedDecision
        ? allowedReconciliationDecisions({
            changeKind: record.changeKind,
            proposedDecision: record.proposedDecision,
          })
        : [],
      previousItem: items.find((item) => item.id === record.previousItemId) ?? null,
      targetItem: items.find((item) => item.id === record.targetItemId) ?? null,
      previousFinding:
        findings.find((finding) => finding.id === record.previousFindingId) ?? null,
      targetFinding:
        findings.find((finding) => finding.id === record.targetFindingId) ?? null,
      targetEvidence: evidence.filter(
        (item) => item.findingId === record.targetFindingId,
      ),
    })),
    ready: reconciliation.status === "ready",
  };
}

export async function decideActionPlanReconciliationItem(input: {
  userId: string;
  organizationId: string;
  itemReconciliationId: string;
  decision: ReconciliationDecision;
  reason: string;
  expectedVersion: number;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const rows = await db
    .select({
      item: actionPlanItemReconciliations,
      reconciliation: actionPlanReconciliations,
    })
    .from(actionPlanItemReconciliations)
    .innerJoin(
      actionPlanReconciliations,
      eq(
        actionPlanItemReconciliations.reconciliationId,
        actionPlanReconciliations.id,
      ),
    )
    .where(
      and(
        eq(actionPlanItemReconciliations.id, input.itemReconciliationId),
        eq(actionPlanReconciliations.organizationId, input.organizationId),
        inArray(actionPlanReconciliations.status, ["draft", "ready"]),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.item.proposedDecision || !row.item.targetItemId) {
    throw new ApiError(404, "Reconciliation item not found");
  }
  if (!requiresReconciliationDecision(row.item.changeKind)) {
    throw new ApiError(409, "This reconciliation item is automatic");
  }
  const allowed = allowedReconciliationDecisions({
    changeKind: row.item.changeKind,
    proposedDecision: row.item.proposedDecision,
  });
  if (!allowed.includes(input.decision)) {
    throw new ApiError(400, "Decision is not valid for this reconciliation item");
  }
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "A reconciliation decision requires a reason");

  await db.transaction(async (tx) => {
    const [lockedReconciliation] = await tx
      .update(actionPlanReconciliations)
      .set({
        status: row.reconciliation.status,
        version: sql`${actionPlanReconciliations.version} + 1`,
      })
      .where(
        and(
          eq(actionPlanReconciliations.id, row.reconciliation.id),
          inArray(actionPlanReconciliations.status, ["draft", "ready"]),
          eq(actionPlanReconciliations.version, input.expectedVersion),
        ),
      )
      .returning();
    if (!lockedReconciliation) {
      throw new ApiError(412, "Reconciliation changed before the decision was saved", { currentVersion: row.reconciliation.version }, "PRECONDITION_FAILED");
    }
    await tx
      .update(actionPlanItemReconciliations)
      .set({
        decidedDecision: input.decision,
        reason,
        decidedBy: input.userId,
        decidedAt: new Date(),
      })
      .where(eq(actionPlanItemReconciliations.id, row.item.id));
    const itemChanges = decisionItemChanges(input.decision);
    await tx
      .update(actionPlanItems)
      .set({ ...itemChanges, updatedAt: new Date() })
      .where(eq(actionPlanItems.id, row.item.targetItemId!));
    const records = await tx.query.actionPlanItemReconciliations.findMany({
      where: eq(
        actionPlanItemReconciliations.reconciliationId,
        row.reconciliation.id,
      ),
    });
    const ready = records.every(
      (record) =>
        !requiresReconciliationDecision(record.changeKind) ||
        record.id === row.item.id ||
        record.decidedDecision,
    );
    await tx
      .update(actionPlanReconciliations)
      .set({ status: ready ? "ready" : "draft" })
      .where(
        and(
          eq(actionPlanReconciliations.id, row.reconciliation.id),
          inArray(actionPlanReconciliations.status, ["draft", "ready"]),
        ),
      );
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "action_plan_reconciliation.item_decided",
      entityType: "action_plan_item_reconciliation",
      entityId: row.item.id,
      metadata: { decision: input.decision, reason },
    });
  });
  return getActionPlanReconciliation(
    input.userId,
    input.organizationId,
    row.reconciliation.id,
  );
}

export async function activateActionPlanReconciliation(input: {
  userId: string;
  organizationId: string;
  reconciliationId: string;
  expectedVersion: number;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const reconciliation = await db.query.actionPlanReconciliations.findFirst({
    where: and(
      eq(actionPlanReconciliations.id, input.reconciliationId),
      eq(actionPlanReconciliations.organizationId, input.organizationId),
    ),
  });
  if (!reconciliation || reconciliation.status !== "ready") {
    throw new ApiError(409, "Complete every reconciliation decision before activation");
  }
  const activatedAt = new Date();
  return db.transaction(async (tx) => {
    const [lockedReconciliation] = await tx
      .update(actionPlanReconciliations)
      .set({ status: "ready" })
      .where(
        and(
          eq(actionPlanReconciliations.id, reconciliation.id),
          eq(actionPlanReconciliations.organizationId, input.organizationId),
          eq(actionPlanReconciliations.status, "ready"),
          eq(actionPlanReconciliations.version, input.expectedVersion),
        ),
      )
      .returning();
    if (!lockedReconciliation) {
      throw new ApiError(412, "Reconciliation changed before activation", { currentVersion: reconciliation.version }, "PRECONDITION_FAILED");
    }
    const [acceptedArtifact] = await tx
      .update(generatedArtifacts)
      .set({ acceptedRevisionId: reconciliation.targetGapRevisionId })
      .where(
        and(
          eq(generatedArtifacts.organizationId, input.organizationId),
          eq(generatedArtifacts.artifactType, "gap_analysis_result"),
          eq(generatedArtifacts.acceptedRevisionId, reconciliation.targetGapRevisionId),
        ),
      )
      .returning();
    if (!acceptedArtifact) {
      throw new ApiError(409, "The accepted gap revision changed; recompute reconciliation");
    }
    const [sourcePlan] = await tx
      .update(actionPlans)
      .set({ status: "superseded", updatedAt: activatedAt })
      .where(
        and(
          eq(actionPlans.id, reconciliation.sourcePlanId),
          eq(actionPlans.organizationId, input.organizationId),
          eq(actionPlans.status, "active"),
          eq(actionPlans.updatedAt, reconciliation.sourcePlanUpdatedAt),
        ),
      )
      .returning();
    if (!sourcePlan) {
      throw new ApiError(409, "The active plan changed; recompute reconciliation");
    }
    const [targetPlan] = await tx
      .update(actionPlans)
      .set({
        status: "active",
        activatedBy: input.userId,
        activatedAt,
        updatedAt: activatedAt,
      })
      .where(
        and(
          eq(actionPlans.id, reconciliation.targetPlanId),
          eq(actionPlans.status, "draft_reconciliation"),
        ),
      )
      .returning();
    if (!targetPlan) throw new ApiError(409, "Reconciled plan is unavailable");
    const [applied] = await tx
      .update(actionPlanReconciliations)
      .set({
        status: "applied",
        appliedBy: input.userId,
        appliedAt: activatedAt,
      })
      .where(
        and(
          eq(actionPlanReconciliations.id, reconciliation.id),
          eq(actionPlanReconciliations.status, "ready"),
        ),
      )
      .returning();
    if (!applied) throw new ApiError(409, "Reconciliation changed before activation");
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "action_plan_reconciliation.activated",
      entityType: "action_plan_reconciliation",
      entityId: reconciliation.id,
      metadata: {
        sourcePlanId: sourcePlan.id,
        targetPlanId: targetPlan.id,
        targetGapRevisionId: reconciliation.targetGapRevisionId,
      },
    });
    return { reconciliation: applied, plan: targetPlan };
  });
}

function decisionItemChanges(decision: ReconciliationDecision) {
  switch (decision) {
    case "close":
      return { status: "done" as const };
    case "reopen":
      return { status: "open" as const };
    case "create_follow_up":
      return { status: "open" as const, ownerUserId: null, dueDate: null };
    case "cancel":
      return { status: "cancelled" as const };
    case "carry_over":
    case "keep_legacy":
      return {};
  }
}

function localize(value: unknown, locale: Locale) {
  const candidate = value as { de?: unknown; en?: unknown };
  const localized = candidate[locale] ?? candidate.de ?? candidate.en;
  return typeof localized === "string" ? localized : "";
}
