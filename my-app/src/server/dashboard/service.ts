import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import { actionPlanItems, actionPlans, activeComplianceCheckReleases, complianceCheckReleases, documents, gapFindings, generatedArtifactRevisions, generatedArtifacts, reports } from "@/src/db/schema";
import { requireOrganizationCapability } from "@/src/server/auth/capability-service";
import { getGapRevisionStaleness } from "@/src/server/gap-analysis";

export async function getOrganizationDashboard(userId: string, organizationId: string) {
  await requireOrganizationCapability(userId, organizationId, "organizations:read");
  const [artifacts, plan, documentRows, latestReport] = await Promise.all([
    db.query.generatedArtifacts.findMany({ columns: { id: true, organizationId: true, moduleId: true, artifactType: true, currentRevisionId: true, acceptedRevisionId: true, createdAt: true }, where: and(eq(generatedArtifacts.organizationId, organizationId), inArray(generatedArtifacts.artifactType, ["affectedness_result", "gap_analysis_result"])) }),
    db.query.actionPlans.findFirst({ columns: { id: true, organizationId: true, sourceGapArtifactRevisionId: true, outputLocale: true, status: true, revisionNumber: true, activatedBy: true, activatedAt: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true, version: true }, where: and(eq(actionPlans.organizationId, organizationId), eq(actionPlans.status, "active")) }),
    db.query.documents.findMany({ columns: { id: true, organizationId: true, title: true, status: true, version: true, currentVersionId: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true }, where: eq(documents.organizationId, organizationId) }),
    db.query.reports.findFirst({ columns: { id: true, organizationId: true, kind: true, locale: true, state: true, inputSnapshot: true, inputHash: true, jobId: true, storageBucket: true, storagePath: true, outputHash: true, fileSize: true, safeErrorCode: true, createdBy: true, createdAt: true, updatedAt: true, completedAt: true }, where: eq(reports.organizationId, organizationId), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
  ]);
  const applicabilityId = artifacts.find((artifact) => artifact.artifactType === "affectedness_result")?.acceptedRevisionId ?? null;
  const gapId = artifacts.find((artifact) => artifact.artifactType === "gap_analysis_result")?.acceptedRevisionId ?? null;
  const [applicability, findings, items] = await Promise.all([
    applicabilityId ? db.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true }, where: eq(generatedArtifactRevisions.id, applicabilityId) }) : null,
    gapId ? db.query.gapFindings.findMany({ columns: { id: true, artifactRevisionId: true, requirementVersionId: true, status: true, evidenceSufficiency: true, severity: true, rationale: true, recommendation: true, assumptions: true, requiresReview: true, createdAt: true }, where: eq(gapFindings.artifactRevisionId, gapId) }) : [],
    plan ? db.query.actionPlanItems.findMany({ columns: { id: true, actionPlanId: true, sourceFindingId: true, title: true, description: true, priority: true, status: true, ownerUserId: true, dueDate: true, createdAt: true, updatedAt: true, version: true }, where: eq(actionPlanItems.actionPlanId, plan.id) }) : [],
  ]);
  const applicabilityRelease = applicability?.checkReleaseId
    ? await db.query.complianceCheckReleases.findFirst({ columns: { id: true, checkCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, scopeModelVersionId: true, scopeThresholdSetId: true, ruleSetId: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, effectiveFrom: true, effectiveTo: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true }, where: eq(complianceCheckReleases.id, applicability.checkReleaseId) })
    : null;
  const activeApplicabilityRelease = applicabilityRelease
    ? await db.query.activeComplianceCheckReleases.findFirst({ columns: { checkCode: true, checkReleaseId: true, activatedBy: true, activatedAt: true }, where: eq(activeComplianceCheckReleases.checkCode, applicabilityRelease.checkCode) })
    : null;
  const gapStaleness = gapId
    ? await getGapRevisionStaleness({ userId, organizationId, revisionId: gapId })
    : null;
  const planSourceStaleness = plan
    ? await getGapRevisionStaleness({ userId, organizationId, revisionId: plan.sourceGapArtifactRevisionId })
    : null;
  const applicabilityArtifact = artifacts.find((artifact) => artifact.artifactType === "affectedness_result");
  const gapArtifact = artifacts.find((artifact) => artifact.artifactType === "gap_analysis_result");
  const evidenceUpdatedAt = latestDate(documentRows.map((document) => document.updatedAt));
  const reportSnapshot = latestReport?.inputSnapshot && typeof latestReport.inputSnapshot === "object"
    ? latestReport.inputSnapshot as Record<string, unknown>
    : null;
  const reportOutdated = Boolean(latestReport && (
    reportSnapshot?.applicabilityRevisionId !== applicabilityId
    || reportSnapshot?.gapRevisionId !== gapId
    || reportSnapshot?.actionPlanId !== (plan?.id ?? null)
  ));
  const nextSteps: string[] = [];
  if (!applicabilityId) nextSteps.push("complete_applicability_check");
  if (!gapId) nextSteps.push("complete_gap_analysis");
  if (!documentRows.some((document) => document.currentVersionId)) nextSteps.push("upload_evidence");
  if (gapId && !plan) nextSteps.push("create_action_plan");
  if (plan && items.some((item) => item.status !== "done" && item.status !== "cancelled")) nextSteps.push("work_action_plan");
  return {
    applicability: {
      outcome: applicability?.outcomeCode ?? null,
      revisionId: applicabilityId,
      sourceUpdatedAt: applicability?.createdAt.toISOString() ?? null,
      stale: Boolean(applicabilityArtifact && applicabilityArtifact.currentRevisionId !== applicabilityArtifact.acceptedRevisionId),
      outdated: Boolean(applicability?.checkReleaseId && activeApplicabilityRelease && activeApplicabilityRelease.checkReleaseId !== applicability.checkReleaseId),
    },
    gap: {
      revisionId: gapId,
      findingCount: findings.length,
      criticalCount: findings.filter((finding) => finding.severity === "critical" && finding.status !== "fulfilled").length,
      sourceUpdatedAt: gapId ? (await db.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true }, where: eq(generatedArtifactRevisions.id, gapId) }))?.createdAt.toISOString() ?? null : null,
      stale: Boolean(gapStaleness?.stale || gapStaleness?.archived || (gapArtifact && gapArtifact.currentRevisionId !== gapArtifact.acceptedRevisionId)),
      outdated: Boolean(gapStaleness?.outdatedRelease),
    },
    evidence: {
      documentCount: documentRows.length,
      currentVersionCount: documentRows.filter((document) => document.currentVersionId).length,
      sourceUpdatedAt: evidenceUpdatedAt?.toISOString() ?? null,
      stale: documentRows.some((document) => document.status === "archived"),
      outdated: false,
    },
    plan: {
      id: plan?.id ?? null,
      openItems: items.filter((item) => !["done", "cancelled"].includes(item.status)).length,
      totalItems: items.length,
      sourceUpdatedAt: plan?.updatedAt.toISOString() ?? null,
      stale: Boolean(planSourceStaleness?.stale || planSourceStaleness?.archived),
      outdated: Boolean(plan && (plan.sourceGapArtifactRevisionId !== gapId || planSourceStaleness?.outdatedRelease)),
    },
    report: {
      id: latestReport?.id ?? null,
      state: latestReport?.state ?? null,
      sourceUpdatedAt: latestReport?.updatedAt.toISOString() ?? null,
      stale: reportOutdated,
      outdated: reportOutdated,
    },
    nextSteps,
  };
}

function latestDate(values: Date[]) {
  return values.length ? new Date(Math.max(...values.map((value) => value.getTime()))) : null;
}
