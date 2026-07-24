import { db } from "@/src/db";
import {
  actionPlans, auditEvents, backgroundJobs, documents, generatedArtifactRevisions, generatedArtifacts,
  reportActionPlanSources, reportArtifactSources, reportDocumentSources, reports,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { localizedFilename } from "@/lib/i18n/format";
import { reportsMessages } from "@/lib/i18n/messages/reports";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { contentHash } from "@/src/server/compliance";
import { requireOrganizationCapability } from "@/src/server/auth/capability-service";
import { ApiError } from "@/src/server/api/errors";
import { toJobDto } from "@/src/server/jobs";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { getCursorCodec } from "@/src/server/api/pagination";
import * as z from "zod";
import { assertReportConcurrency } from "./quota";

export const REPORT_STORAGE_BUCKET = "compliance-reports";
type Source = { sourceType: string; sourceId: string };

export async function createReport(input: { userId: string; organizationId: string; locale: Locale; kind: "compliance_summary" }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "reports:create");
  const [active] = await db.select({ count: sql<number>`count(*)::int` }).from(reports).where(and(
    eq(reports.organizationId, input.organizationId),
    inArray(reports.state, ["queued", "rendering"]),
  ));
  assertReportConcurrency(active.count);
  const artifacts = await db.query.generatedArtifacts.findMany({ columns: { id: true, organizationId: true, moduleId: true, artifactType: true, currentRevisionId: true, acceptedRevisionId: true, createdAt: true }, where: and(
    eq(generatedArtifacts.organizationId, input.organizationId),
    inArray(generatedArtifacts.artifactType, ["affectedness_result", "gap_analysis_result"]),
  ) });
  const plan = await db.query.actionPlans.findFirst({ columns: { id: true, organizationId: true, sourceGapArtifactRevisionId: true, outputLocale: true, status: true, revisionNumber: true, activatedBy: true, activatedAt: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true, version: true }, where: and(eq(actionPlans.organizationId, input.organizationId), eq(actionPlans.status, "active")) });
  const documentRows = await db.query.documents.findMany({ columns: { id: true, organizationId: true, title: true, status: true, version: true, currentVersionId: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true }, where: eq(documents.organizationId, input.organizationId) });
  const sources: Source[] = [
    ...artifacts.flatMap((artifact) => artifact.acceptedRevisionId ? [{ sourceType: artifact.artifactType, sourceId: artifact.acceptedRevisionId }] : []),
    ...(plan ? [{ sourceType: "action_plan", sourceId: plan.id }] : []),
    ...documentRows.flatMap((document) => document.currentVersionId ? [{ sourceType: "document_version", sourceId: document.currentVersionId }] : []),
  ];
  const snapshot = {
    capturedAt: new Date().toISOString(), kind: input.kind, locale: input.locale,
    applicabilityRevisionId: sources.find((source) => source.sourceType === "affectedness_result")?.sourceId ?? null,
    gapRevisionId: sources.find((source) => source.sourceType === "gap_analysis_result")?.sourceId ?? null,
    actionPlanId: plan?.id ?? null,
    documentVersionIds: sources.filter((source) => source.sourceType === "document_version").map((source) => source.sourceId).sort(),
  };
  return db.transaction(async (tx) => {
    const [report] = await tx.insert(reports).values({
      organizationId: input.organizationId, kind: input.kind, locale: input.locale,
      inputSnapshot: snapshot, inputHash: contentHash(snapshot), createdBy: input.userId,
    }).returning();
    if (!report) throw new ApiError(500, "Could not create report", undefined, "REPORT_CREATE_FAILED");
    const [job] = await tx.insert(backgroundJobs).values({
      organizationId: input.organizationId, requestedByUserId: input.userId, kind: "report-render",
      payload: { reportId: report.id }, cancellable: true, cancellationCapability: "reports:create",
    }).returning();
    if (!job) throw new ApiError(500, "Could not enqueue report", undefined, "REPORT_CREATE_FAILED");
    const [linked] = await tx.update(reports).set({ jobId: job.id, updatedAt: new Date() }).where(eq(reports.id, report.id)).returning();
    const artifactSources = sources.filter((source) =>
      source.sourceType === "affectedness_result" || source.sourceType === "gap_analysis_result"
    );
    const actionPlanSources = sources.filter((source) => source.sourceType === "action_plan");
    const documentSources = sources.filter((source) => source.sourceType === "document_version");
    if (artifactSources.length) {
      await tx.insert(reportArtifactSources).values(
        artifactSources.map((source) => ({ reportId: report.id, artifactRevisionId: source.sourceId })),
      );
    }
    if (actionPlanSources.length) {
      await tx.insert(reportActionPlanSources).values(
        actionPlanSources.map((source) => ({ reportId: report.id, actionPlanId: source.sourceId })),
      );
    }
    if (documentSources.length) {
      await tx.insert(reportDocumentSources).values(
        documentSources.map((source) => ({ reportId: report.id, documentVersionId: source.sourceId })),
      );
    }
    await tx.insert(auditEvents).values({ organizationId: input.organizationId, actorUserId: input.userId, eventType: "report.created", entityType: "report", entityId: report.id, metadata: { inputHash: report.inputHash, sourceCount: sources.length } });
    return { report: toReportDto(linked!), job: toJobDto(job) };
  });
}


export async function listReports(userId: string, organizationId: string) {
  return (await listReportsPage({ userId, organizationId, limit: 50 })).reports;
}

const reportCursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);
export async function listReportsPage(input: { userId: string; organizationId: string; limit: number; cursor?: string }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "reports:read");
  const scope = `reports:${input.organizationId}`;
  const cursor = input.cursor ? reportCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.reports.findMany({ columns: { id: true, organizationId: true, kind: true, locale: true, state: true, inputSnapshot: true, inputHash: true, jobId: true, storageBucket: true, storagePath: true, outputHash: true, fileSize: true, safeErrorCode: true, createdBy: true, createdAt: true, updatedAt: true, completedAt: true },
    where: and(
      eq(reports.organizationId, input.organizationId),
      cursor ? or(lt(reports.createdAt, new Date(cursor[0])), and(eq(reports.createdAt, new Date(cursor[0])), lt(reports.id, cursor[1]))) : undefined,
    ),
    orderBy: [desc(reports.createdAt), desc(reports.id)],
    limit: input.limit + 1,
  });
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return {
    reports: page.map(toReportDto),
    nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined,
  };
}

export async function getReportDetail(userId: string, organizationId: string, reportId: string) {
  await requireOrganizationCapability(userId, organizationId, "reports:read");
  const report = await db.query.reports.findFirst({ columns: { id: true, organizationId: true, kind: true, locale: true, state: true, inputSnapshot: true, inputHash: true, jobId: true, storageBucket: true, storagePath: true, outputHash: true, fileSize: true, safeErrorCode: true, createdBy: true, createdAt: true, updatedAt: true, completedAt: true }, where: and(eq(reports.id, reportId), eq(reports.organizationId, organizationId)) });
  if (!report) throw new ApiError(404, "Report not found", undefined, "REPORT_NOT_FOUND");
  const [artifactSources, actionPlanSources, documentSources, job] = await Promise.all([
    db.select({
      sourceType: generatedArtifacts.artifactType,
      sourceId: reportArtifactSources.artifactRevisionId,
    }).from(reportArtifactSources)
      .innerJoin(generatedArtifactRevisions, eq(reportArtifactSources.artifactRevisionId, generatedArtifactRevisions.id))
      .innerJoin(generatedArtifacts, eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id))
      .where(eq(reportArtifactSources.reportId, report.id)),
    db.select({ sourceId: reportActionPlanSources.actionPlanId })
      .from(reportActionPlanSources)
      .where(eq(reportActionPlanSources.reportId, report.id)),
    db.select({ sourceId: reportDocumentSources.documentVersionId })
      .from(reportDocumentSources)
      .where(eq(reportDocumentSources.reportId, report.id)),
    report.jobId ? db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true }, where: eq(backgroundJobs.id, report.jobId) }) : null,
  ]);
  const sources: Source[] = [
    ...artifactSources,
    ...actionPlanSources.map(({ sourceId }) => ({ sourceType: "action_plan", sourceId })),
    ...documentSources.map(({ sourceId }) => ({ sourceType: "document_version", sourceId })),
  ];
  return { report: toReportDto(report), sources, job: job ? toJobDto(job) : null };
}

export async function createReportDownload(userId: string, organizationId: string, reportId: string) {
  await requireOrganizationCapability(userId, organizationId, "reports:read");
  const report = await db.query.reports.findFirst({ columns: { id: true, organizationId: true, kind: true, locale: true, state: true, inputSnapshot: true, inputHash: true, jobId: true, storageBucket: true, storagePath: true, outputHash: true, fileSize: true, safeErrorCode: true, createdBy: true, createdAt: true, updatedAt: true, completedAt: true }, where: and(eq(reports.id, reportId), eq(reports.organizationId, organizationId), eq(reports.state, "ready")) });
  if (!report?.storageBucket || !report.storagePath) throw new ApiError(409, "Report is not ready", undefined, "REPORT_NOT_READY");
  const locale = report.locale as Locale;
  const fileName = localizedFilename(
    reportsMessages[locale].reports.pdf.fileName,
    locale,
    "pdf",
  );
  const { data, error } = await getSupabaseAdminClient().storage.from(report.storageBucket).createSignedUrl(report.storagePath, 120, { download: fileName });
  if (error || !data) throw new ApiError(503, "Report download is unavailable", undefined, "REPORT_DOWNLOAD_UNAVAILABLE");
  await db.insert(auditEvents).values({ organizationId, actorUserId: userId, eventType: "report.downloaded", entityType: "report", entityId: report.id, metadata: {} });
  return { url: data.signedUrl, expiresInSeconds: 120 };
}

function toReportDto(report: typeof reports.$inferSelect) {
  return { ...report, locale: report.locale as Locale, createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(), completedAt: report.completedAt?.toISOString() ?? null };
}
