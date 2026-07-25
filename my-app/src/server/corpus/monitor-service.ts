import { db } from "@/src/db";
import { backgroundJobs, legalSourceChangeAlerts, legalSourceMonitorChecks, legalSourceMonitors, legalSources, legalSourceVersions, platformAuditEvents } from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { validateControlledUrl } from "./controlled-url";
import { legalSourceMonitorScheduleSchema } from "@/src/contracts/admin";

export async function createLegalSourceMonitor(input: {
  actorUserId: string;
  sourceId: string;
  exactUrl: string;
  schedule: string;
  nextCheckAt?: Date;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:operate");
  const source = await db.query.legalSources.findFirst({ columns: { id: true, familyId: true, stableCode: true, title: true, sourceKind: true, authorityTier: true, canonicalPublisher: true, legalInstrumentId: true, legalProvisionId: true, withdrawnAt: true, withdrawalReason: true, version: true, createdBy: true, createdAt: true, updatedAt: true }, where: eq(legalSources.id, input.sourceId) });
  if (!source) throw new ApiError(404, "Legal source not found", undefined, "LEGAL_SOURCE_NOT_FOUND");
  const url = await validateControlledUrl(input.exactUrl);
  const schedule = legalSourceMonitorScheduleSchema.parse(input.schedule);
  const nextCheckAt = input.nextCheckAt ?? new Date();
  return db.transaction(async (tx) => {
    const [monitor] = await tx.insert(legalSourceMonitors).values({
      sourceId: source.id,
      exactUrl: url.toString(),
      schedule,
      nextCheckAt,
      createdBy: input.actorUserId,
    }).returning();
    const [job] = await tx.insert(backgroundJobs).values({
      kind: "legal-source-monitor",
      payload: { monitorId: monitor.id },
      requestedByUserId: input.actorUserId,
      cancellable: false,
      runAfter: nextCheckAt,
    }).returning();
    await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_source_monitor.created", entityType: "legal_source_monitor", entityId: monitor.id, requestId: input.requestId, metadata: { sourceId: source.id, jobId: job.id } });
    return { monitor, job };
  });
}

export async function getLegalSourceMonitorCreationResult(actorUserId: string, jobId: string) {
  await requirePlatformCapability(actorUserId, "corpus:read");
  const job = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true }, where: eq(backgroundJobs.id, jobId) });
  const payload = job?.payload && typeof job.payload === "object" ? job.payload as Record<string, unknown> : null;
  if (!job || job.kind !== "legal-source-monitor" || typeof payload?.monitorId !== "string") {
    throw new ApiError(409, "Created monitor result is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE");
  }
  const monitor = await db.query.legalSourceMonitors.findFirst({ columns: { id: true, sourceId: true, exactUrl: true, schedule: true, active: true, etag: true, lastModified: true, lastCheckedAt: true, nextCheckAt: true, version: true, createdBy: true, createdAt: true, updatedAt: true }, where: eq(legalSourceMonitors.id, payload.monitorId) });
  if (!monitor) throw new ApiError(409, "Created monitor result is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE");
  return { monitor, job };
}

export async function resolveLegalSourceChangeAlert(input: {
  actorUserId: string;
  alertId: string;
  resolution: "dismiss" | "create_candidate";
  reason: string;
  candidateVersionLabel?: string;
  language?: string;
  requestId?: string;
  expectedVersion: number;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "A resolution reason is required", undefined, "RESOLUTION_REASON_REQUIRED");
  return db.transaction(async (tx) => {
    const alert = await tx.query.legalSourceChangeAlerts.findFirst({ columns: { id: true, monitorCheckId: true, sourceId: true, oldHash: true, newHash: true, candidateVersionId: true, state: true, resolvedBy: true, resolutionReason: true, resolvedAt: true, version: true, createdAt: true },
      where: and(eq(legalSourceChangeAlerts.id, input.alertId), eq(legalSourceChangeAlerts.state, "open"), eq(legalSourceChangeAlerts.version, input.expectedVersion)),
    });
    if (!alert) throw new ApiError(412, "The change alert changed or is no longer open", undefined, "PRECONDITION_FAILED");
    const check = await tx.query.legalSourceMonitorChecks.findFirst({ columns: { id: true, monitorId: true, responseStatus: true, finalUrl: true, responseMetadata: true, contentHash: true, changeDetected: true, safeErrorCode: true, checkedAt: true }, where: eq(legalSourceMonitorChecks.id, alert.monitorCheckId) });
    if (!check) throw new ApiError(409, "Monitor check is missing", undefined, "MONITOR_CHECK_MISSING");
    const monitor = await tx.query.legalSourceMonitors.findFirst({ columns: { id: true, sourceId: true, exactUrl: true, schedule: true, active: true, etag: true, lastModified: true, lastCheckedAt: true, nextCheckAt: true, version: true, createdBy: true, createdAt: true, updatedAt: true }, where: eq(legalSourceMonitors.id, check.monitorId) });
    if (!monitor) throw new ApiError(409, "Source monitor is missing", undefined, "MONITOR_MISSING");
    let candidateVersionId: string | undefined;
    let jobId: string | undefined;
    if (input.resolution === "create_candidate") {
      if (!input.candidateVersionLabel?.trim() || !input.language?.trim()) {
        throw new ApiError(400, "Candidate version label and language are required", undefined, "CANDIDATE_METADATA_REQUIRED");
      }
      const [candidate] = await tx.insert(legalSourceVersions).values({
        sourceId: alert.sourceId,
        versionLabel: input.candidateVersionLabel.trim(),
        upstreamUrl: check.finalUrl ?? monitor.exactUrl,
        retrievedAt: check.checkedAt,
        contentHash: alert.newHash,
        createdBy: input.actorUserId,
      }).returning();
      candidateVersionId = candidate.id;
      const [job] = await tx.insert(backgroundJobs).values({
        kind: "legal-source-import",
        payload: {
          sourceId: alert.sourceId,
          existingVersionId: candidate.id,
          exactUrl: monitor.exactUrl,
          versionLabel: candidate.versionLabel,
          language: input.language.trim(),
        },
        requestedByUserId: input.actorUserId,
        cancellable: true,
      }).returning();
      jobId = job.id;
    }
    const now = new Date();
    const [resolved] = await tx.update(legalSourceChangeAlerts).set({
      state: input.resolution === "dismiss" ? "dismissed" : "candidate_created",
      candidateVersionId,
      resolvedBy: input.actorUserId,
      resolutionReason: reason,
      resolvedAt: now,
      version: input.expectedVersion + 1,
    }).where(and(eq(legalSourceChangeAlerts.id, alert.id), eq(legalSourceChangeAlerts.state, "open"), eq(legalSourceChangeAlerts.version, input.expectedVersion))).returning();
    if (!resolved) throw new ApiError(412, "The change alert changed", undefined, "PRECONDITION_FAILED");
    await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_source_change_alert.resolved", entityType: "legal_source_change_alert", entityId: resolved.id, requestId: input.requestId, metadata: { resolution: input.resolution, reason, candidateVersionId, jobId } });
    return { alert: resolved, jobId };
  });
}
