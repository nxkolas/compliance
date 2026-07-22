import * as z from "zod";
import { db } from "@/src/db";
import {
  backgroundJobs,
  aiProcessingRuns,
  auditEvents,
  legalCorpusReleases,
  legalSourceMonitorChecks,
  legalSourceMonitors,
  legalSourceProcessingGenerations,
  gapReassessmentDrafts,
  reports,
} from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { nextLegalSourceMonitorCheck } from "@/src/contracts/admin/legal-source-monitor-schedule";

export async function recordWorkerDomainFailure(
  job: typeof backgroundJobs.$inferSelect,
  errorCode: string,
) {
  if (job.kind === "legal-source-process") {
    const payload = z.object({ renditionId: z.uuid() }).safeParse(job.payload);
    if (!payload.success) return;
    await db.update(legalSourceProcessingGenerations).set({
      state: "failed",
      safeErrorCode: errorCode,
      updatedAt: new Date(),
    }).where(eq(legalSourceProcessingGenerations.jobId, job.id));
  } else if (job.kind === "legal-source-embed") {
    const payload = z.object({ generationId: z.uuid() }).safeParse(job.payload);
    if (!payload.success) return;
    await db.update(legalSourceProcessingGenerations).set({
      state: "failed",
      safeErrorCode: errorCode,
      updatedAt: new Date(),
    }).where(eq(legalSourceProcessingGenerations.id, payload.data.generationId));
  } else if (job.kind === "legal-source-monitor") {
    const payload = z.object({ monitorId: z.uuid() }).safeParse(job.payload);
    if (!payload.success) return;
    const monitor = await db.query.legalSourceMonitors.findFirst({
      where: eq(legalSourceMonitors.id, payload.data.monitorId),
    });
    if (monitor) {
      const checkedAt = new Date();
      await db.transaction(async (tx) => {
        await tx.insert(legalSourceMonitorChecks).values({
          monitorId: monitor.id,
          safeErrorCode: errorCode,
          checkedAt,
        });
        await tx.update(legalSourceMonitors).set({
          lastCheckedAt: checkedAt,
          nextCheckAt: nextLegalSourceMonitorCheck(monitor.schedule, checkedAt),
          updatedAt: checkedAt,
        }).where(and(eq(legalSourceMonitors.id, monitor.id), eq(legalSourceMonitors.active, true)));
      });
    }
  } else if (job.kind === "grounding-evaluation") {
    const payload = z.object({ releaseId: z.uuid() }).safeParse(job.payload);
    if (!payload.success) return;
    await db.update(legalCorpusReleases).set({
      evaluationState: "failed",
      updatedAt: new Date(),
    }).where(eq(legalCorpusReleases.id, payload.data.releaseId));
  } else if (job.kind === "gap-generation") {
    await db.update(aiProcessingRuns).set({
      status: "failed",
      errorCode,
      errorMessage: "The background operation failed.",
      completedAt: new Date(),
    }).where(and(eq(aiProcessingRuns.jobId, job.id), eq(aiProcessingRuns.status, "processing")));
    await db.update(gapReassessmentDrafts).set({ status: "failed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(gapReassessmentDrafts.generationJobId, job.id));
    if (job.organizationId) await db.insert(auditEvents).values({
      organizationId: job.organizationId,
      actorUserId: job.requestedByUserId,
      eventType: "gap_reassessment.failed",
      entityType: "background_job",
      entityId: job.id,
      metadata: { errorCode },
    });
  } else if (job.kind === "report-render") {
    await db.update(reports).set({ state: "failed", safeErrorCode: errorCode, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(reports.jobId, job.id));
  }
}

export async function recordWorkerDomainCancellation(job: typeof backgroundJobs.$inferSelect) {
  if (job.kind === "report-render") {
    await db.update(reports).set({ state: "cancelled", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(reports.jobId, job.id));
    return;
  }
  if (job.kind !== "gap-generation") return;
  await db.update(gapReassessmentDrafts).set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(gapReassessmentDrafts.generationJobId, job.id));
  if (job.organizationId) await db.insert(auditEvents).values({
    organizationId: job.organizationId,
    actorUserId: job.requestedByUserId,
    eventType: "gap_reassessment.cancelled",
    entityType: "background_job",
    entityId: job.id,
    metadata: {},
  });
}
