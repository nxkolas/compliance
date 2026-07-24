import { db } from "@/src/db";
import {
  actionPlans, auditEvents, backgroundJobs, documents, generatedArtifacts,
  reportSources, reports,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { localizedFilename } from "@/lib/i18n/format";
import { reportsMessages } from "@/lib/i18n/messages/reports";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { contentHash } from "@/src/server/compliance/publishing/canonical-json";
import { requireOrganizationCapability } from "@/src/server/auth/capability-service";
import { ApiError } from "@/src/server/api/errors";
import { toJobDto } from "@/src/server/jobs/service";
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
  const artifacts = await db.query.generatedArtifacts.findMany({ where: and(
    eq(generatedArtifacts.organizationId, input.organizationId),
    inArray(generatedArtifacts.artifactType, ["affectedness_result", "gap_analysis_result"]),
  ) });
  const plan = await db.query.actionPlans.findFirst({ where: and(eq(actionPlans.organizationId, input.organizationId), eq(actionPlans.status, "active")) });
  const documentRows = await db.query.documents.findMany({ where: eq(documents.organizationId, input.organizationId) });
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
    if (sources.length) await tx.insert(reportSources).values(sources.map((source) => ({ reportId: report.id, ...source })));
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
  const rows = await db.query.reports.findMany({
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
  const report = await db.query.reports.findFirst({ where: and(eq(reports.id, reportId), eq(reports.organizationId, organizationId)) });
  if (!report) throw new ApiError(404, "Report not found", undefined, "REPORT_NOT_FOUND");
  const [sources, job] = await Promise.all([
    db.query.reportSources.findMany({ where: eq(reportSources.reportId, report.id) }),
    report.jobId ? db.query.backgroundJobs.findFirst({ where: eq(backgroundJobs.id, report.jobId) }) : null,
  ]);
  return { report: toReportDto(report), sources: sources.map(({ sourceType, sourceId }) => ({ sourceType, sourceId })), job: job ? toJobDto(job) : null };
}

export async function createReportDownload(userId: string, organizationId: string, reportId: string) {
  await requireOrganizationCapability(userId, organizationId, "reports:read");
  const report = await db.query.reports.findFirst({ where: and(eq(reports.id, reportId), eq(reports.organizationId, organizationId), eq(reports.state, "ready")) });
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
