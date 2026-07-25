import * as z from "zod";
import { and, eq } from "drizzle-orm";
import type { BackgroundJobRecord } from "@/src/server/jobs";
import { auditEvents, backgroundJobResults, backgroundJobs as jobs, reports } from "@/src/db/schema";
import { db } from "@/src/db";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { REPORT_STORAGE_BUCKET } from "./service";
import { renderComplianceReport } from "./renderer";
import { createHash } from "node:crypto";

const payloadSchema = z.object({ reportId: z.uuid() });
const snapshotSchema = z.object({
  capturedAt: z.iso.datetime(), applicabilityRevisionId: z.uuid().nullable(), gapRevisionId: z.uuid().nullable(),
  actionPlanId: z.uuid().nullable(), documentVersionIds: z.array(z.uuid()),
}).loose();

export async function handleReportRender(job: BackgroundJobRecord) {
  const { reportId } = payloadSchema.parse(job.payload);
  if (!job.organizationId) throw new Error("Report job has no organization scope");
  const [report] = await db.update(reports).set({ state: "rendering", updatedAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.jobId, job.id), eq(reports.state, "queued"))).returning();
  if (!report) {
    const existing = await db.query.reports.findFirst({ columns: { id: true, organizationId: true, kind: true, locale: true, state: true, inputSnapshot: true, inputHash: true, jobId: true, storageBucket: true, storagePath: true, outputHash: true, fileSize: true, safeErrorCode: true, createdBy: true, createdAt: true, updatedAt: true, completedAt: true }, where: { RAW: (table, operators) => (and(eq(table.id, reportId), eq(table.jobId, job.id))) ?? operators.sql`true` } });
    if (existing?.state === "ready") return { type: "report", id: existing.id };
    throw new Error("Report is unavailable for rendering");
  }
  const snapshot = snapshotSchema.parse(report.inputSnapshot);
  const pdf = await renderComplianceReport({ reportId, organizationId: job.organizationId, locale: report.locale as "de" | "en", snapshot, inputHash: report.inputHash });
  const outputHash = createHash("sha256").update(pdf).digest("hex");
  const currentJob = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, job.id)) ?? operators.sql`true` } });
  if (currentJob?.state === "cancellation_requested") throw Object.assign(new Error("Report rendering cancelled"), { name: "JobCancellationError" });
  const path = `${job.organizationId}/${report.id}.pdf`;
  const storage = getSupabaseAdminClient().storage.from(REPORT_STORAGE_BUCKET);
  const { error } = await storage.upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Could not store report: ${error.message}`);
  const afterUpload = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, job.id)) ?? operators.sql`true` } });
  if (afterUpload?.state === "cancellation_requested") {
    await storage.remove([path]);
    throw Object.assign(new Error("Report rendering cancelled"), { name: "JobCancellationError" });
  }
  try {
    await db.transaction(async (tx) => {
      const [lockedJob] = await tx.select({ state: jobs.state }).from(jobs)
        .where(eq(jobs.id, job.id)).limit(1).for("update");
      if (lockedJob?.state === "cancellation_requested") {
        throw Object.assign(new Error("Report rendering cancelled"), { name: "JobCancellationError" });
      }
      if (lockedJob?.state !== "running") throw new Error("Report job no longer owns persistence");
      const [ready] = await tx.update(reports).set({ state: "ready", storageBucket: REPORT_STORAGE_BUCKET, storagePath: path, outputHash, fileSize: pdf.byteLength, completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(reports.id, report.id), eq(reports.state, "rendering"))).returning({ id: reports.id });
      if (!ready) throw new Error("Report no longer owns persistence");
      await tx.insert(auditEvents).values({ organizationId: job.organizationId!, actorUserId: job.requestedByUserId, eventType: "report.ready", entityType: "report", entityId: report.id, metadata: { inputHash: report.inputHash, outputHash, fileSize: pdf.byteLength } });
      const [completedJob] = await tx.update(jobs).set({
        state: "succeeded", progress: 100,
        leaseOwner: null, leaseExpiresAt: null, finishedAt: new Date(), updatedAt: new Date(),
      }).where(and(eq(jobs.id, job.id), eq(jobs.state, "running"))).returning({ id: jobs.id });
      if (!completedJob) throw new Error("Report job no longer owns persistence");
      await tx.insert(backgroundJobResults).values({
        jobId: completedJob.id,
        reportId: report.id,
      });
    });
  } catch (error) {
    await storage.remove([path]);
    throw error;
  }
  return { type: "report", id: report.id };
}
