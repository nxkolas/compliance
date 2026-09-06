import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  actionPlanItems,
  aiProcessingRunContext,
  assessmentAnswers,
  auditEvents,
  backgroundJobs,
  gapFindingContextLinks,
  gapFindings,
  gapItems,
  reportDocumentSources,
  reports,
} from "@/src/db/schema";
import { throwIfJobExecutionAborted } from "@/src/server/platform/jobs/execution/abort";
import type { BackgroundJobRecord } from "@/src/server/platform/jobs";
import { getSupabaseAdminClient } from "@/src/server/platform/storage/supabase-admin";
import { assertLiveParentJobForAiRun } from "@/src/server/platform/ai/generation/job-run-lifecycle";
import {
  formatLegalCitations,
  type LegalCitation,
} from "@/src/server/modules/compliance";
import {
  countGapStatuses,
  gapStatusOrder,
  type GapStatus,
} from "@/src/server/modules/gap-analysis";
import { buildLegalReferenceResolver } from "./legal-references";
import { renderComplianceReport } from "./renderer";
import {
  assertPendingReportFinalization,
  hashReportRenderSnapshot,
  type ReportActionStatus,
  type ReportContentSnapshot,
  type ReportRenderSnapshot,
} from "./render-snapshot";
import { REPORT_STORAGE_BUCKET } from "./report-library";

export async function handleReportRender(
  job: BackgroundJobRecord,
  reportId: string,
  abortSignal?: AbortSignal,
) {
  throwIfJobExecutionAborted(abortSignal);
  if (!job.organizationId) throw new Error("Report job has no organization scope");
  const organizationId = job.organizationId;
  const report = await db.query.reports.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, reportId), eq(table.organizationId, organizationId), eq(table.renderingJobId, job.id)) ?? operators.sql`true` },
  });
  if (!report) throw new Error("Report is unavailable for rendering");
  if (isCompletedReport(report)) return { type: "report", id: report.id };
  assertPendingReportFinalization(report);
  if (!job.leaseOwner) throw new Error("Report job lease owner is missing");
  await assertLiveParentJobForAiRun({
    jobId: job.id,
    organizationId,
    expectedLeaseOwner: job.leaseOwner,
  });
  const documentSources = await db.select({ documentVersionId: reportDocumentSources.documentVersionId })
    .from(reportDocumentSources)
    .where(eq(reportDocumentSources.reportId, report.id))
    .orderBy(asc(reportDocumentSources.position));
  const content = await loadReportContent(report);
  const snapshot: ReportRenderSnapshot = {
    capturedAt: new Date().toISOString(),
    locale: report.locale as "de" | "en",
    applicabilityRevisionId: report.applicabilityRevisionId,
    gapRevisionId: report.gapRevisionId,
    actionPlanId: report.actionPlanId,
    documentVersionIds: documentSources.map((source) => source.documentVersionId),
    content,
  };
  const inputHash = hashReportRenderSnapshot(snapshot);
  const pdf = await renderComplianceReport({
    locale: report.locale as "de" | "en",
    snapshot,
  });
  throwIfJobExecutionAborted(abortSignal);
  const pdfHash = createHash("sha256").update(pdf).digest("hex");
  const pdfKey = `${organizationId}/${report.id}.pdf`;
  const storage = getSupabaseAdminClient().storage.from(REPORT_STORAGE_BUCKET);
  const { error } = await storage.upload(pdfKey, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Could not store report: ${error.message}`);
  throwIfJobExecutionAborted(abortSignal);
  await db.transaction(async (tx) => {
    const now = new Date();
    const [liveJob] = await tx.select({
      state: backgroundJobs.state,
      leaseOwner: backgroundJobs.leaseOwner,
      leaseExpiresAt: backgroundJobs.leaseExpiresAt,
      cancellationRequestedAt: backgroundJobs.cancellationRequestedAt,
    }).from(backgroundJobs)
      .where(eq(backgroundJobs.id, job.id))
      .limit(1)
      .for("update");
    if (
      !liveJob ||
      liveJob.state !== "running" ||
      liveJob.leaseOwner !== job.leaseOwner ||
      !liveJob.leaseExpiresAt ||
      liveJob.leaseExpiresAt <= now ||
      liveJob.cancellationRequestedAt
    ) {
      throw new Error("Report render lease ownership was lost");
    }
    const [lockedReport] = await tx.select().from(reports)
      .where(and(
        eq(reports.id, report.id),
        eq(reports.renderingJobId, job.id),
        eq(reports.organizationId, organizationId),
      ))
      .limit(1)
      .for("update");
    if (!lockedReport) throw new Error("Report no longer owns persistence");
    if (isCompletedReport(lockedReport)) return;
    assertPendingReportFinalization(lockedReport);
    const [saved] = await tx.update(reports).set({
      inputHash,
      pdfBucket: REPORT_STORAGE_BUCKET,
      pdfKey,
      pdfHash,
      pdfByteSize: pdf.byteLength,
    }).where(eq(reports.id, report.id)).returning();
    if (!saved) throw new Error("Report no longer owns persistence");
    await tx.insert(auditEvents).values({
        organizationId,
        actorUserId: job.requestedBy,
        eventType: "report.ready",
        entityType: "report",
        entityId: report.id,
        metadata: { inputHash, pdfHash, pdfByteSize: pdf.byteLength },
      });
  });
  return { type: "report", id: report.id };
}

function isCompletedReport(report: {
  inputHash: string | null;
  pdfBucket: string | null;
  pdfKey: string | null;
  pdfHash: string | null;
  pdfByteSize: number | null;
}) {
  return Boolean(
    report.inputHash &&
      report.pdfBucket &&
      report.pdfKey &&
      report.pdfHash &&
      report.pdfByteSize,
  );
}

async function loadReportContent(
  report: typeof reports.$inferSelect,
): Promise<ReportContentSnapshot> {
  const locale = report.locale === "en" ? "en" : "de";
  const [organization, applicability, findingRows, actionRows] = await Promise.all([
    // The worker has no user session, so this reads `db` directly like every
    // other load below instead of going through the auth-scoped org service.
    db.query.organizations.findFirst({
      columns: { name: true, legalName: true },
      where: { RAW: (table, operators) => eq(table.id, report.organizationId) ?? operators.sql`true` },
    }),
    db.query.analysisOutputRevisions.findFirst({
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.id, report.applicabilityRevisionId),
            eq(table.organizationId, report.organizationId),
          ) ?? operators.sql`true`,
      },
    }),
    report.gapRevisionId
      ? db.select().from(gapFindings)
          .where(and(
            eq(gapFindings.organizationId, report.organizationId),
            eq(gapFindings.outputRevisionId, report.gapRevisionId),
          ))
          .orderBy(asc(gapFindings.position))
      : Promise.resolve([]),
    report.actionPlanId
      ? db.select().from(actionPlanItems)
          .where(and(
            eq(actionPlanItems.organizationId, report.organizationId),
            eq(actionPlanItems.actionPlanId, report.actionPlanId),
          ))
          .orderBy(asc(actionPlanItems.position))
      : Promise.resolve([]),
  ]);
  if (!organization) throw new Error("The report organization is unavailable");
  if (!applicability) throw new Error("Pinned applicability result is unavailable");
  const [answerRows, gapRows, contextRows] = await Promise.all([
    db.select().from(assessmentAnswers)
      .where(eq(assessmentAnswers.assessmentRevisionId, applicability.assessmentRevisionId))
      .orderBy(asc(assessmentAnswers.position)),
    findingRows.length
      ? db.select().from(gapItems)
          .where(inArray(gapItems.findingId, findingRows.map((finding) => finding.id)))
          .orderBy(asc(gapItems.position))
      : Promise.resolve([]),
    findingRows.length
      ? db.select({
          findingId: gapFindingContextLinks.findingId,
          context: aiProcessingRunContext,
        }).from(gapFindingContextLinks)
          .innerJoin(aiProcessingRunContext, eq(aiProcessingRunContext.id, gapFindingContextLinks.contextId))
          .where(inArray(gapFindingContextLinks.findingId, findingRows.map((finding) => finding.id)))
      : Promise.resolve([]),
  ]);
  const legalReferences = buildLegalReferenceResolver(locale);
  // Findings are surfaced worst-first, matching the Gap-Analyse filter order.
  const orderedFindings = [...findingRows].sort(
    (left, right) =>
      gapStatusOrder.indexOf(left.status) - gapStatusOrder.indexOf(right.status) ||
      left.position - right.position,
  );
  const statusByFindingId = new Map(
    findingRows.map((finding) => [finding.id, finding.status as GapStatus]),
  );
  // `countGapStatuses` also returns an `all` total over findings; the report
  // uses the gap-item count for its headline figure instead.
  const findingCounts = countGapStatuses(
    findingRows.map((finding) => ({ finding: { status: finding.status as GapStatus } })),
  );
  const gapStatusCounts = {
    not_fulfilled: findingCounts.not_fulfilled,
    partially_fulfilled: findingCounts.partially_fulfilled,
    insufficient_evidence: findingCounts.insufficient_evidence,
    fulfilled: findingCounts.fulfilled,
  };

  return {
    organization: {
      name: organization.name,
      legalName: organization.legalName,
    },
    applicability: {
      outcome: applicabilityLabel(applicability.result, applicability.outcomeCode),
      outcomeCode: applicability.outcomeCode,
      jurisdiction: applicability.jurisdictionCode,
      answers: answerRows.map((answer) => ({
        question: answer.questionText,
        answer: answer.selectedOptionLabels.join(", ") || displayValue(answer.answerValue),
      })),
    },
    gap: report.gapRevisionId
      ? {
          openGapItemCount: gapRows.filter(
            (gap) => statusByFindingId.get(gap.findingId) !== "fulfilled",
          ).length,
          statusCounts: gapStatusCounts,
          findings: orderedFindings.map((finding) => ({
            title: finding.requirementTitle,
            status: finding.status as GapStatus,
            hasOrganizationDocument: contextRows.some(
              (item) =>
                item.findingId === finding.id &&
                item.context.channel === "organization_evidence",
            ),
            reviewNotice:
              finding.materialContradiction && !finding.contradictionResolved
                ? finding.summary
                : null,
            gaps: gapRows
              .filter((gap) => gap.findingId === finding.id)
              .map((gap) => gap.statement),
            legalReferences: legalReferences.forRequirement(finding.requirementKey),
          })),
        }
      : null,
    actions: {
      statusCounts: countActionStatuses(actionRows),
      groups: orderedFindings.flatMap((finding) => {
        const items = actionRows
          .filter((action) => action.findingId === finding.id)
          .sort(
            (left, right) =>
              actionStatusOrder.indexOf(left.status) -
                actionStatusOrder.indexOf(right.status) ||
              left.position - right.position,
          );
        if (!items.length) return [];
        return [{
          findingTitle: finding.requirementTitle,
          items: items.map((action) => ({
            title: action.title,
            result: action.result,
            suggestedEvidence: action.suggestedEvidence,
            status: action.status,
          })),
        }];
      }),
    },
    sourceRegister: buildSourceRegister(
      contextRows.map((row) => row.context),
      legalReferences.forProvisionKey,
      locale,
    ),
  };
}

const actionStatusOrder: ReportActionStatus[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
];

function countActionStatuses(rows: Array<{ status: ReportActionStatus }>) {
  const counts: Record<ReportActionStatus, number> = {
    open: 0,
    in_progress: 0,
    done: 0,
    cancelled: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/**
 * Collapses the linked grounding contexts into one row per source document:
 * title, the distinct provisions it was cited for, and the pages they came from.
 * Deliberately carries no excerpts and no identifiers.
 */
function buildSourceRegister(
  contexts: Array<typeof aiProcessingRunContext.$inferSelect>,
  citation: (provisionKey: string) => LegalCitation,
  locale: "de" | "en",
) {
  const pageLabel = locale === "de" ? "S." : "p.";
  const grouped = new Map<
    string,
    { title: string; references: LegalCitation[]; pages: Set<number> }
  >();

  for (const context of contexts) {
    const metadata = isRecord(context.metadata) ? context.metadata : {};
    const title = typeof metadata.title === "string" && metadata.title.trim()
      ? metadata.title.trim()
      : fallbackSourceTitle(context.channel, locale);
    const entry = grouped.get(title) ?? {
      title,
      references: [] as LegalCitation[],
      pages: new Set<number>(),
    };
    if (typeof metadata.mappedLegalProvisionKey === "string") {
      entry.references.push(citation(metadata.mappedLegalProvisionKey));
    }
    if (Number.isInteger(metadata.pageNumber) && (metadata.pageNumber as number) > 0) {
      entry.pages.add(metadata.pageNumber as number);
    }
    grouped.set(title, entry);
  }

  return [...grouped.values()]
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((entry) => ({
      title: entry.title,
      reference: formatLegalCitations(entry.references) || null,
      location: entry.pages.size
        ? `${pageLabel} ${[...entry.pages].sort((left, right) => left - right).join(", ")}`
        : null,
    }));
}

function fallbackSourceTitle(channel: string, locale: "de" | "en") {
  if (channel === "legal_authority") {
    return locale === "de" ? "Rechtsquelle" : "Legal authority";
  }
  return locale === "de" ? "Nachweisdokument" : "Organization evidence";
}

function applicabilityLabel(result: unknown, fallback: string | null) {
  if (isRecord(result) && isRecord(result.result)) {
    const localized = result.result;
    if (typeof localized.label === "string") return localized.label;
    if (typeof localized.labelEn === "string") return localized.labelEn;
  }
  return fallback ?? "Unknown";
}

function displayValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
