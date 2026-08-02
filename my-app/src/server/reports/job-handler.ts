import { createHash } from "node:crypto";
import * as z from "zod";
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
import { throwIfJobExecutionAborted } from "@/src/server/job-execution/abort";
import type { BackgroundJobRecord } from "@/src/server/jobs";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { assertLiveParentJobForAiRun } from "@/src/server/ai/generation/job-run-lifecycle";
import { renderComplianceReport } from "./renderer";
import {
  assertPendingReportFinalization,
  hashReportRenderSnapshot,
  type ReportContentSnapshot,
  type ReportRenderSnapshot,
} from "./render-snapshot";
import { REPORT_STORAGE_BUCKET } from "./service";

const payloadSchema = z.object({ reportId: z.uuid() });

export async function handleReportRender(job: BackgroundJobRecord, abortSignal?: AbortSignal) {
  throwIfJobExecutionAborted(abortSignal);
  const { reportId } = payloadSchema.parse(job.payload);
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
    reportId,
    organizationId,
    locale: report.locale as "de" | "en",
    snapshot,
    inputHash,
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
  const [applicability, findingRows, actionRows] = await Promise.all([
    db.query.analysisOutputRevisions.findFirst({
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.id, report.applicabilityRevisionId),
            eq(table.organizationId, report.organizationId),
          ) ?? operators.sql`true`,
      },
    }),
    db.select().from(gapFindings)
      .where(and(
        eq(gapFindings.organizationId, report.organizationId),
        eq(gapFindings.outputRevisionId, report.gapRevisionId),
      ))
      .orderBy(asc(gapFindings.position)),
    report.actionPlanId
      ? db.select().from(actionPlanItems)
          .where(and(
            eq(actionPlanItems.organizationId, report.organizationId),
            eq(actionPlanItems.actionPlanId, report.actionPlanId),
          ))
          .orderBy(asc(actionPlanItems.position))
      : Promise.resolve([]),
  ]);
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
  return {
    applicability: {
      outcome: applicabilityLabel(applicability.result, applicability.outcomeCode),
      jurisdiction: applicability.jurisdictionCode,
      answers: answerRows.map((answer) => ({
        question: answer.questionText,
        answer: answer.selectedOptionLabels.join(", ") || displayValue(answer.answerValue),
      })),
    },
    findings: findingRows.map((finding) => ({
      title: finding.requirementTitle,
      status: finding.status,
      summary: finding.summary,
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
      sources: contextRows
        .filter((item) => item.findingId === finding.id)
        .map((item) => reportSource(item.context)),
    })),
    actions: actionRows.map((action) => ({
      title: action.title,
      description: action.description,
      status: action.status,
    })),
  };
}

function applicabilityLabel(result: unknown, fallback: string | null) {
  if (isRecord(result) && isRecord(result.result)) {
    const localized = result.result;
    if (typeof localized.label === "string") return localized.label;
    if (typeof localized.labelEn === "string") return localized.labelEn;
  }
  return fallback ?? "Unknown";
}

function reportSource(context: typeof aiProcessingRunContext.$inferSelect) {
  const metadata = isRecord(context.metadata) ? context.metadata : {};
  const title = typeof metadata.title === "string"
    ? metadata.title
    : context.channel === "legal_authority"
      ? "Legal authority"
      : "Organization evidence";
  const page = typeof metadata.pageNumber === "number" ? ` — page ${metadata.pageNumber}` : "";
  return `${title}${page}: ${context.exactText}`;
}

function displayValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
