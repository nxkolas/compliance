import { createHash } from "node:crypto";
import * as z from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import { auditEvents, reportDocumentSources, reports } from "@/src/db/schema";
import { throwIfJobExecutionAborted } from "@/src/server/job-execution/abort";
import type { BackgroundJobRecord } from "@/src/server/jobs";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { renderComplianceReport } from "./renderer";
import { REPORT_STORAGE_BUCKET } from "./service";

const payloadSchema = z.object({ reportId: z.uuid() });

export async function handleReportRender(job: BackgroundJobRecord, abortSignal?: AbortSignal) {
  throwIfJobExecutionAborted(abortSignal);
  const { reportId } = payloadSchema.parse(job.payload);
  if (!job.organizationId) throw new Error("Report job has no organization scope");
  const report = await db.query.reports.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, reportId), eq(table.organizationId, job.organizationId!), eq(table.renderingJobId, job.id)) ?? operators.sql`true` },
  });
  if (!report) throw new Error("Report is unavailable for rendering");
  if (report.pdfKey) return { type: "report", id: report.id };
  const documentSources = await db.select({ documentVersionId: reportDocumentSources.documentVersionId })
    .from(reportDocumentSources)
    .where(eq(reportDocumentSources.reportId, report.id))
    .orderBy(asc(reportDocumentSources.position));
  const pdf = await renderComplianceReport({
    reportId,
    organizationId: job.organizationId,
    locale: report.locale as "de" | "en",
    snapshot: {
      capturedAt: report.createdAt.toISOString(),
      applicabilityRevisionId: report.applicabilityRevisionId,
      gapRevisionId: report.gapRevisionId,
      actionPlanId: report.actionPlanId,
      documentVersionIds: documentSources.map((source) => source.documentVersionId),
    },
    inputHash: report.inputHash,
  });
  throwIfJobExecutionAborted(abortSignal);
  const pdfHash = createHash("sha256").update(pdf).digest("hex");
  const pdfKey = `${job.organizationId}/${report.id}.pdf`;
  const storage = getSupabaseAdminClient().storage.from(REPORT_STORAGE_BUCKET);
  const { error } = await storage.upload(pdfKey, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Could not store report: ${error.message}`);
  try {
    throwIfJobExecutionAborted(abortSignal);
    const [saved] = await db.update(reports).set({
      pdfBucket: REPORT_STORAGE_BUCKET,
      pdfKey,
      pdfHash,
      pdfByteSize: pdf.byteLength,
    }).where(and(eq(reports.id, report.id), eq(reports.renderingJobId, job.id), isNull(reports.pdfKey))).returning();
    if (!saved) {
      const existing = await db.query.reports.findFirst({
        columns: { pdfKey: true },
        where: { RAW: (table, operators) => eq(table.id, report.id) ?? operators.sql`true` },
      });
      if (!existing?.pdfKey) throw new Error("Report no longer owns persistence");
    } else {
      await db.insert(auditEvents).values({
        organizationId: job.organizationId,
        actorUserId: job.requestedBy,
        eventType: "report.ready",
        entityType: "report",
        entityId: report.id,
        metadata: { inputHash: report.inputHash, pdfHash, pdfByteSize: pdf.byteLength },
      });
    }
  } catch (error) {
    await storage.remove([pdfKey]);
    throw error;
  }
  return { type: "report", id: report.id };
}
