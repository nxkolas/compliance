import { createHash } from "node:crypto";
import * as z from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { backgroundJobs, legalSourceChangeAlerts, legalSourceMonitorChecks, legalSourceMonitors } from "@/src/db/schema";
import { LEGAL_SOURCE_MIME_TYPES, MAX_LEGAL_SOURCE_BYTES } from "@/src/server/corpus/config";
import { fetchControlledUrl } from "../security/controlled-url";
import { nextLegalSourceMonitorCheck } from "@/src/contracts/admin/legal-source-monitor-schedule";

const payloadSchema = z.object({ monitorId: z.uuid() });

export async function handleLegalSourceMonitor(job: typeof backgroundJobs.$inferSelect) {
  const { monitorId } = payloadSchema.parse(job.payload);
  const monitor = await db.query.legalSourceMonitors.findFirst({ where: eq(legalSourceMonitors.id, monitorId) });
  if (!monitor?.active) return { type: "legal_source_monitor", id: monitorId };
  const previous = await db.query.legalSourceMonitorChecks.findFirst({
    where: eq(legalSourceMonitorChecks.monitorId, monitor.id),
    orderBy: [desc(legalSourceMonitorChecks.checkedAt)],
  });
  const fetched = await fetchControlledUrl({
    url: monitor.exactUrl,
    maxBytes: MAX_LEGAL_SOURCE_BYTES,
    timeoutMs: 30_000,
    allowedMimeTypes: LEGAL_SOURCE_MIME_TYPES,
    requestHeaders: {
      ...(monitor.etag ? { "if-none-match": monitor.etag } : {}),
      ...(monitor.lastModified ? { "if-modified-since": monitor.lastModified } : {}),
    },
  });
  if (fetched.notModified && !previous?.contentHash) {
    throw new Error("Source returned not-modified before an initial content hash was recorded");
  }
  const contentHash = fetched.notModified
    ? previous!.contentHash!
    : createHash("sha256").update(fetched.bytes).digest("hex");
  const changed = !fetched.notModified && Boolean(previous?.contentHash && previous.contentHash !== contentHash);
  const checkedAt = new Date();
  await db.transaction(async (tx) => {
    const current = await tx.query.legalSourceMonitors.findFirst({
      where: and(
        eq(legalSourceMonitors.id, monitor.id),
        eq(legalSourceMonitors.active, true),
        eq(legalSourceMonitors.version, monitor.version),
      ),
    });
    if (!current) return;
    const [check] = await tx.insert(legalSourceMonitorChecks).values({
      monitorId: monitor.id,
      responseStatus: fetched.status,
      finalUrl: fetched.finalUrl,
      responseMetadata: {
        mimeType: fetched.mimeType || undefined,
        byteSize: fetched.notModified ? undefined : fetched.bytes.byteLength,
        etag: fetched.etag,
        lastModified: fetched.lastModified,
      },
      contentHash,
      changeDetected: changed,
      checkedAt,
    }).returning();
    if (changed) await tx.insert(legalSourceChangeAlerts).values({ monitorCheckId: check.id, sourceId: monitor.sourceId, oldHash: previous?.contentHash, newHash: contentHash });
    await tx.update(legalSourceMonitors).set({
      etag: fetched.etag ?? monitor.etag,
      lastModified: fetched.lastModified ?? monitor.lastModified,
      lastCheckedAt: checkedAt,
      nextCheckAt: nextLegalSourceMonitorCheck(monitor.schedule, checkedAt),
      updatedAt: checkedAt,
    }).where(and(
      eq(legalSourceMonitors.id, monitor.id),
      eq(legalSourceMonitors.active, true),
      eq(legalSourceMonitors.version, monitor.version),
    ));
  });
  return { type: "legal_source_monitor", id: monitor.id };
}
