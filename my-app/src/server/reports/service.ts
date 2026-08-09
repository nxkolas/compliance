import { randomUUID } from "node:crypto";
import * as z from "zod";
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { Locale } from "@/lib/i18n-config";
import { localizedFilename } from "@/lib/i18n/format";
import { reportsMessages } from "@/lib/i18n/messages/reports";
import {
  analysisOutputDocumentSources,
  auditEvents,
  backgroundJobs,
  reportDocumentSources,
  reports,
} from "@/src/db/schema";
import { ApiError } from "@/src/server/api/errors";
import { getCursorCodec } from "@/src/server/api/pagination";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand } from "@/src/server/auth/organization-scope";
import { enqueueJob, toJobDto } from "@/src/server/jobs";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { assertReportConcurrency } from "./quota";
import { resolveReportInputRevisions } from "./input-policy";

export const REPORT_STORAGE_BUCKET = "compliance-reports";

export async function createReport(input: { userId: string; organizationId: string; locale: Locale }) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "reports:create" }, async ({ executor: db }) => {
  const [active] = await db.select({ count: sql<number>`count(*)::int` })
    .from(backgroundJobs)
    .where(and(
      eq(backgroundJobs.organizationId, input.organizationId),
      eq(backgroundJobs.kind, "report_render"),
      inArray(backgroundJobs.state, ["queued", "leased", "running"]),
    ));
  assertReportConcurrency(active?.count ?? 0);

  const [applicability, gap, plan] = await Promise.all([
    db.query.analysisOutputs.findFirst({
      columns: { currentRevisionId: true },
      where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "applicability")) ?? operators.sql`true` },
    }),
    db.query.analysisOutputs.findFirst({
      columns: { currentRevisionId: true },
      where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
    }),
    db.query.actionPlans.findFirst({
      columns: { id: true },
      where: { RAW: (table, operators) => eq(table.organizationId, input.organizationId) ?? operators.sql`true` },
    }),
  ]);
  const { applicabilityRevisionId, gapRevisionId } = resolveReportInputRevisions({
    applicability,
    gap,
  });
  const actionPlanId = gapRevisionId ? plan?.id ?? null : null;
  const documentSources = gapRevisionId
    ? await db.select({
        documentVersionId: analysisOutputDocumentSources.documentVersionId,
        position: analysisOutputDocumentSources.position,
      }).from(analysisOutputDocumentSources)
        .where(and(
          eq(analysisOutputDocumentSources.organizationId, input.organizationId),
          eq(analysisOutputDocumentSources.outputRevisionId, gapRevisionId),
        ))
        .orderBy(asc(analysisOutputDocumentSources.position))
    : [];

  const reportId = randomUUID();
  const jobId = randomUUID();
    const job = await enqueueJob({
      organizationId: input.organizationId,
      requestedByUserId: input.userId,
      kind: "report_render",
      payload: { reportId },
    }, { executor: db, jobId });
    const [report] = await db.insert(reports).values({
      id: reportId,
      organizationId: input.organizationId,
      applicabilityRevisionId,
      gapRevisionId,
      actionPlanId,
      renderingJobId: jobId,
      locale: input.locale,
      createdBy: input.userId,
    }).returning();
    if (!report) throw new ApiError(500, "Could not create report", undefined, "REPORT_CREATE_FAILED");
    if (documentSources.length) {
      await db.insert(reportDocumentSources).values(documentSources.map((document) => ({
        organizationId: input.organizationId,
        reportId,
        documentVersionId: document.documentVersionId,
        position: document.position,
      })));
    }
    await db.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "report.created",
      entityType: "report",
      entityId: reportId,
      metadata: { documentCount: documentSources.length },
    });
    return { report: toReportDto(report, job), job: toJobDto(job) };
  });
}

export async function listReports(userId: string, organizationId: string) {
  return (await listReportsPage({ userId, organizationId, limit: 50 })).reports;
}

const reportCursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);
export async function listReportsPage(input: { userId: string; organizationId: string; limit: number; cursor?: string }) {
  const { executor: db } = await authorizeOrganizationRead({ actorUserId: input.userId, organizationId: input.organizationId, capability: "reports:read" });
  const scope = `reports:${input.organizationId}`;
  const cursor = input.cursor ? reportCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.select({ report: reports, job: backgroundJobs })
    .from(reports)
    .innerJoin(backgroundJobs, eq(reports.renderingJobId, backgroundJobs.id))
    .where(and(
      eq(reports.organizationId, input.organizationId),
      cursor ? or(lt(reports.createdAt, new Date(cursor[0])), and(eq(reports.createdAt, new Date(cursor[0])), lt(reports.id, cursor[1]))) : undefined,
    ))
    .orderBy(sql`${reports.createdAt} desc`, sql`${reports.id} desc`)
    .limit(input.limit + 1);
  const page = rows.slice(0, input.limit);
  const last = page.at(-1)?.report;
  return {
    reports: page.map(({ report, job }) => toReportDto(report, job)),
    nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined,
  };
}

export async function getReportDetail(userId: string, organizationId: string, reportId: string) {
  const { executor: db } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "reports:read" });
  const [row] = await db.select({ report: reports, job: backgroundJobs })
    .from(reports)
    .innerJoin(backgroundJobs, eq(reports.renderingJobId, backgroundJobs.id))
    .where(and(eq(reports.id, reportId), eq(reports.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new ApiError(404, "Report not found", undefined, "REPORT_NOT_FOUND");
  const sources = await db.select({
    documentVersionId: reportDocumentSources.documentVersionId,
    position: reportDocumentSources.position,
  }).from(reportDocumentSources)
    .where(and(eq(reportDocumentSources.organizationId, organizationId), eq(reportDocumentSources.reportId, reportId)))
    .orderBy(asc(reportDocumentSources.position));
  return { report: toReportDto(row.report, row.job), sources, job: toJobDto(row.job) };
}

export async function createReportDownload(userId: string, organizationId: string, reportId: string) {
  const scope = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "reports:read" });
  const report = await scope.executor.query.reports.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, reportId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!report?.pdfBucket || !report.pdfKey) throw new ApiError(409, "Report is not ready", undefined, "REPORT_NOT_READY");
  const locale = report.locale as Locale;
  const fileName = localizedFilename(reportsMessages[locale].reports.pdf.fileName, locale, "pdf");
  const { data, error } = await getSupabaseAdminClient().storage.from(report.pdfBucket)
    .createSignedUrl(report.pdfKey, 120, { download: fileName });
  if (error || !data) throw new ApiError(503, "Report download is unavailable", undefined, "REPORT_DOWNLOAD_UNAVAILABLE");
  await withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "reports:read" }, async ({ executor }) => {
    await executor.insert(auditEvents).values({ organizationId, actorUserId: userId, eventType: "report.downloaded", entityType: "report", entityId: report.id, metadata: {} });
  });
  return { url: data.signedUrl, expiresInSeconds: 120 };
}

function toReportDto(report: typeof reports.$inferSelect, job: typeof backgroundJobs.$inferSelect) {
  return {
    id: report.id,
    organizationId: report.organizationId,
    applicabilityRevisionId: report.applicabilityRevisionId,
    gapRevisionId: report.gapRevisionId,
    actionPlanId: report.actionPlanId,
    renderingJobId: report.renderingJobId,
    locale: report.locale as Locale,
    inputHash: report.inputHash,
    pdfHash: report.pdfHash,
    pdfByteSize: report.pdfByteSize,
    state: report.pdfKey ? "ready" as const : deriveReportState(job.state),
    createdAt: report.createdAt.toISOString(),
  };
}

function deriveReportState(state: typeof backgroundJobs.$inferSelect.state) {
  if (state === "failed") return "failed" as const;
  if (state === "cancelled") return "cancelled" as const;
  if (state === "running" || state === "leased") return "rendering" as const;
  return "queued" as const;
}
