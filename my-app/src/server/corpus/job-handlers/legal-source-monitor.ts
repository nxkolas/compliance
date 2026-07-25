import { createHash } from "node:crypto";
import * as z from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { backgroundJobs, legalSourceChangeAlerts, legalSourceMonitorChecks, legalSourceMonitors } from "@/src/db/schema";
import { LEGAL_SOURCE_MIME_TYPES, MAX_LEGAL_SOURCE_BYTES } from "../config";
import { fetchControlledUrl } from "../controlled-url";
import { nextLegalSourceMonitorCheck } from "@/src/contracts/admin/legal-source-monitor-schedule";

const payloadSchema = z.object({ monitorId: z.uuid() });

export async function handleLegalSourceMonitor(job: typeof backgroundJobs.$inferSelect) {
  const { monitorId } = payloadSchema.parse(job.payload);
  const monitor = await db.query.legalSourceMonitors.findFirst({ columns: { id: true, sourceId: true, exactUrl: true, schedule: true, active: true, etag: true, lastModified: true, lastCheckedAt: true, nextCheckAt: true, version: true, createdBy: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, monitorId)) ?? operators.sql`true` } });
  if (!monitor?.active) return { type: "legal_source_monitor", id: monitorId };
  const previous = await db.query.legalSourceMonitorChecks.findFirst({ columns: { id: true, monitorId: true, responseStatus: true, finalUrl: true, responseMetadata: true, contentHash: true, changeDetected: true, safeErrorCode: true, checkedAt: true },
    where: { RAW: (table, operators) => (eq(table.monitorId, monitor.id)) ?? operators.sql`true` },
    orderBy: { checkedAt: "desc" },
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
    const current = await tx.query.legalSourceMonitors.findFirst({ columns: { id: true, sourceId: true, exactUrl: true, schedule: true, active: true, etag: true, lastModified: true, lastCheckedAt: true, nextCheckAt: true, version: true, createdBy: true, createdAt: true, updatedAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.id, monitor.id),
        eq(table.active, true),
        eq(table.version, monitor.version),
      )) ?? operators.sql`true` },
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
