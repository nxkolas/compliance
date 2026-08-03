import { and, eq, inArray } from "drizzle-orm";
import { currentApplicabilityDefinitionHash, currentGapDefinitionHash } from "@/src/server/definitions";
import { authorizeOrganizationRead } from "@/src/server/auth/organization-scope";

export async function getOrganizationDashboard(userId: string, organizationId: string) {
  const { executor: db } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "organizations:read" });
  const [outputs, plan, documentRows, latestReport] = await Promise.all([
    db.query.analysisOutputs.findMany({
      where: { RAW: (table, operators) => and(eq(table.organizationId, organizationId), inArray(table.kind, ["applicability", "gap"])) ?? operators.sql`true` },
    }),
    db.query.actionPlans.findFirst({
      where: { RAW: (table, operators) => eq(table.organizationId, organizationId) ?? operators.sql`true` },
    }),
    db.query.documents.findMany({
      where: { RAW: (table, operators) => eq(table.organizationId, organizationId) ?? operators.sql`true` },
    }),
    db.query.reports.findFirst({
      where: { RAW: (table, operators) => eq(table.organizationId, organizationId) ?? operators.sql`true` },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const applicabilityId = outputs.find((output) => output.kind === "applicability")?.currentRevisionId ?? null;
  const gapId = outputs.find((output) => output.kind === "gap")?.currentRevisionId ?? null;
  const [applicability, gap, findings, items, reportJob] = await Promise.all([
    applicabilityId ? db.query.analysisOutputRevisions.findFirst({ where: { RAW: (table, operators) => eq(table.id, applicabilityId) ?? operators.sql`true` } }) : null,
    gapId ? db.query.analysisOutputRevisions.findFirst({ where: { RAW: (table, operators) => eq(table.id, gapId) ?? operators.sql`true` } }) : null,
    gapId ? db.query.gapFindings.findMany({ where: { RAW: (table, operators) => eq(table.outputRevisionId, gapId) ?? operators.sql`true` } }) : [],
    plan ? db.query.actionPlanItems.findMany({ where: { RAW: (table, operators) => eq(table.actionPlanId, plan.id) ?? operators.sql`true` } }) : [],
    latestReport ? db.query.backgroundJobs.findFirst({ where: { RAW: (table, operators) => eq(table.id, latestReport.renderingJobId) ?? operators.sql`true` } }) : null,
  ]);
  const currentDocuments = documentRows.filter((document) => document.currentVersionId && !document.archivedAt);
  const evidenceUpdatedAt = latestDate(documentRows.map((document) => document.updatedAt));
  const planUpdatedAt = latestDate([plan?.createdAt, ...items.map((item) => item.updatedAt)].filter((value): value is Date => Boolean(value)));
  const reportOutdated = Boolean(latestReport && (
    latestReport.applicabilityRevisionId !== applicabilityId
    || latestReport.gapRevisionId !== gapId
    || latestReport.actionPlanId !== (plan?.id ?? null)
  ));
  const nextSteps: string[] = [];
  if (!applicabilityId) nextSteps.push("complete_applicability_check");
  if (!gapId) nextSteps.push("complete_gap_analysis");
  if (!currentDocuments.length) nextSteps.push("upload_evidence");
  if (gapId && !plan) nextSteps.push("create_action_plan");
  if (plan && items.some((item) => item.status !== "done")) nextSteps.push("work_action_plan");
  return {
    applicability: {
      outcome: applicability?.outcomeCode ?? null,
      revisionId: applicabilityId,
      sourceUpdatedAt: applicability?.createdAt.toISOString() ?? null,
      stale: false,
      outdated: Boolean(applicability && applicability.definitionHash !== currentApplicabilityDefinitionHash),
    },
    gap: {
      revisionId: gapId,
      findingCount: findings.length,
      criticalCount: findings.filter((finding) => finding.criticality === "critical" && finding.status !== "fulfilled").length,
      sourceUpdatedAt: gap?.createdAt.toISOString() ?? null,
      stale: false,
      outdated: Boolean(gap && gap.definitionHash !== currentGapDefinitionHash),
    },
    evidence: {
      documentCount: documentRows.length,
      currentVersionCount: currentDocuments.length,
      sourceUpdatedAt: evidenceUpdatedAt?.toISOString() ?? null,
      stale: documentRows.some((document) => Boolean(document.archivedAt)),
      outdated: false,
    },
    plan: {
      id: plan?.id ?? null,
      openItems: items.filter((item) => item.status !== "done").length,
      totalItems: items.length,
      sourceUpdatedAt: planUpdatedAt?.toISOString() ?? null,
      stale: Boolean(plan && plan.sourceGapRevisionId !== gapId),
      outdated: false,
    },
    report: {
      id: latestReport?.id ?? null,
      state: latestReport ? reportState(latestReport.pdfKey, reportJob?.state) : null,
      sourceUpdatedAt: latestReport ? (reportJob?.updatedAt ?? latestReport.createdAt).toISOString() : null,
      stale: reportOutdated,
      outdated: reportOutdated,
    },
    nextSteps,
  };
}

function latestDate(values: Date[]) {
  return values.length ? new Date(Math.max(...values.map((value) => value.getTime()))) : null;
}

function reportState(pdfKey: string | null, jobState?: string) {
  if (pdfKey) return "ready";
  if (jobState === "failed" || jobState === "cancelled") return jobState;
  if (jobState === "running" || jobState === "leased") return "rendering";
  return "queued";
}
