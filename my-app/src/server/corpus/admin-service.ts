import { and, asc, desc, eq, gt, ilike, isNull, lt, or } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/src/db";
import { legalCorpusFamilies, legalCorpusReleaseMembers, legalCorpusReleases, legalSourceChangeAlerts, legalSourceChunks, legalSourceMonitors, legalSourceRenditions, legalSources, legalSourceVersions, platformAuditEvents } from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { ApiError } from "@/src/server/api/errors";
import { getCursorCodec } from "@/src/server/api/pagination";
import { legalSourceMonitorScheduleSchema } from "@/src/contracts/admin";
import { syncLegalSourceMonitorJob } from "./monitor-scheduler";

const dateCursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);
const textCursorSchema = z.tuple([z.string(), z.uuid()]);

export async function getCorpusFamily(userId: string, familyId: string) { await requirePlatformCapability(userId, "corpus:read"); const row = await db.query.legalCorpusFamilies.findFirst({ where: eq(legalCorpusFamilies.id, familyId) }); if (!row) throw new ApiError(404, "Corpus family not found", undefined, "CORPUS_FAMILY_NOT_FOUND"); return row; }
export async function updateCorpusFamily(input: { actorUserId: string; familyId: string; title: string; archived?: boolean; expectedVersion: number; requestId?: string }) { await requirePlatformCapability(input.actorUserId, "corpus:curate"); return db.transaction(async (tx) => { const [row] = await tx.update(legalCorpusFamilies).set({ title: input.title, archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null, version: input.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(legalCorpusFamilies.id, input.familyId), eq(legalCorpusFamilies.version, input.expectedVersion))).returning(); if (!row) throw new ApiError(412, "Corpus family changed", undefined, "PRECONDITION_FAILED"); await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_corpus_family.updated", entityType: "legal_corpus_family", entityId: row.id, requestId: input.requestId, metadata: { archived: Boolean(row.archivedAt), version: row.version } }); return row; }); }
export async function listLegalSources(userId: string, query?: string) { return (await listLegalSourcesPage({ userId, query, limit: 100 })).sources; }
export async function listLegalSourcesPage(input: { userId: string; query?: string; limit: number; cursor?: string }) { await requirePlatformCapability(input.userId, "corpus:read"); const normalizedQuery = input.query?.trim() || undefined; const scope = `corpus-sources:${normalizedQuery ?? ""}`; const cursor = input.cursor ? textCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null; const rows = await db.query.legalSources.findMany({ where: and(normalizedQuery ? ilike(legalSources.title, `%${normalizedQuery}%`) : undefined, cursor ? or(gt(legalSources.title, cursor[0]), and(eq(legalSources.title, cursor[0]), gt(legalSources.id, cursor[1]))) : undefined), orderBy: [asc(legalSources.title), asc(legalSources.id)], limit: input.limit + 1 }); const page = rows.slice(0, input.limit); const last = page.at(-1); return { sources: page, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.title, last.id]) : undefined }; }
export async function getLegalSource(userId: string, sourceId: string) { await requirePlatformCapability(userId, "corpus:read"); const source = await db.query.legalSources.findFirst({ where: eq(legalSources.id, sourceId) }); if (!source) throw new ApiError(404, "Legal source not found", undefined, "LEGAL_SOURCE_NOT_FOUND"); const versions = await db.query.legalSourceVersions.findMany({ where: eq(legalSourceVersions.sourceId, source.id), orderBy: [desc(legalSourceVersions.createdAt)] }); return { source, versions }; }
export async function updateLegalSource(input: { actorUserId: string; sourceId: string; title: string; canonicalPublisher: string; expectedVersion: number; requestId?: string }) { await requirePlatformCapability(input.actorUserId, "corpus:curate"); return db.transaction(async (tx) => { const [source] = await tx.update(legalSources).set({ title: input.title, canonicalPublisher: input.canonicalPublisher, version: input.expectedVersion + 1, updatedAt: new Date() }).where(and(eq(legalSources.id, input.sourceId), eq(legalSources.version, input.expectedVersion), isNull(legalSources.withdrawnAt))).returning(); if (!source) throw new ApiError(412, "Legal source changed", undefined, "PRECONDITION_FAILED"); await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_source.updated", entityType: "legal_source", entityId: source.id, requestId: input.requestId, metadata: { version: source.version } }); return source; }); }
export async function getLegalSourceVersion(userId: string, versionId: string) { await requirePlatformCapability(userId, "corpus:read"); const version = await db.query.legalSourceVersions.findFirst({ where: eq(legalSourceVersions.id, versionId) }); if (!version) throw new ApiError(404, "Source version not found", undefined, "LEGAL_SOURCE_VERSION_NOT_FOUND"); const renditions = await db.query.legalSourceRenditions.findMany({ where: eq(legalSourceRenditions.sourceVersionId, version.id) }); const generations = renditions.length ? await db.query.legalSourceProcessingGenerations.findMany({ where: (row, { inArray }) => inArray(row.renditionId, renditions.map((item) => item.id)) }) : []; return { version, renditions, generations }; }
export async function getLegalChunk(userId: string, chunkId: string) { await requirePlatformCapability(userId, "corpus:read"); const chunk = await db.query.legalSourceChunks.findFirst({ where: eq(legalSourceChunks.id, chunkId) }); if (!chunk) throw new ApiError(404, "Chunk not found", undefined, "LEGAL_CHUNK_NOT_FOUND"); return chunk; }
export async function listCorpusReleases(userId: string) { return (await listCorpusReleasesPage({ userId, limit: 100 })).releases; }
export async function listCorpusReleasesPage(input: { userId: string; limit: number; cursor?: string }) { await requirePlatformCapability(input.userId, "corpus:read"); const scope = "corpus-releases"; const cursor = input.cursor ? dateCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null; const rows = await db.query.legalCorpusReleases.findMany({ where: cursor ? or(lt(legalCorpusReleases.createdAt, new Date(cursor[0])), and(eq(legalCorpusReleases.createdAt, new Date(cursor[0])), lt(legalCorpusReleases.id, cursor[1]))) : undefined, orderBy: [desc(legalCorpusReleases.createdAt), desc(legalCorpusReleases.id)], limit: input.limit + 1 }); const page = rows.slice(0, input.limit); const last = page.at(-1); return { releases: page, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined }; }
export async function getCorpusRelease(userId: string, releaseId: string) { await requirePlatformCapability(userId, "corpus:read"); const release = await db.query.legalCorpusReleases.findFirst({ where: eq(legalCorpusReleases.id, releaseId) }); if (!release) throw new ApiError(404, "Corpus release not found", undefined, "CORPUS_RELEASE_NOT_FOUND"); return { release, members: await db.query.legalCorpusReleaseMembers.findMany({ where: eq(legalCorpusReleaseMembers.releaseId, release.id), orderBy: [asc(legalCorpusReleaseMembers.position)] }) }; }
export async function listCorpusMonitors(userId: string) { return (await listCorpusMonitorsPage({ userId, limit: 100 })).monitors; }
export async function listCorpusMonitorsPage(input: { userId: string; limit: number; cursor?: string }) { await requirePlatformCapability(input.userId, "corpus:read"); const scope = "corpus-monitors"; const cursor = input.cursor ? dateCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null; const rows = await db.query.legalSourceMonitors.findMany({ where: cursor ? or(gt(legalSourceMonitors.nextCheckAt, new Date(cursor[0])), and(eq(legalSourceMonitors.nextCheckAt, new Date(cursor[0])), gt(legalSourceMonitors.id, cursor[1]))) : undefined, orderBy: [asc(legalSourceMonitors.nextCheckAt), asc(legalSourceMonitors.id)], limit: input.limit + 1 }); const page = rows.slice(0, input.limit); const last = page.at(-1); return { monitors: page, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.nextCheckAt.toISOString(), last.id]) : undefined }; }
export async function updateCorpusMonitor(input: { actorUserId: string; monitorId: string; schedule: string; paused: boolean; expectedVersion: number; requestId?: string }) {
  await requirePlatformCapability(input.actorUserId, "corpus:operate");
  const schedule = legalSourceMonitorScheduleSchema.parse(input.schedule);
  return db.transaction(async (tx) => {
    const current = await tx.query.legalSourceMonitors.findFirst({
      where: and(
        eq(legalSourceMonitors.id, input.monitorId),
        eq(legalSourceMonitors.version, input.expectedVersion),
      ),
    });
    if (!current) throw new ApiError(412, "Monitor changed", undefined, "PRECONDITION_FAILED");
    const active = !input.paused;
    const nextCheckAt = active && (!current.active || current.schedule !== schedule)
      ? new Date()
      : current.nextCheckAt;
    const [monitor] = await tx.update(legalSourceMonitors).set({
      schedule,
      active,
      nextCheckAt,
      version: input.expectedVersion + 1,
      updatedAt: new Date(),
    }).where(and(
      eq(legalSourceMonitors.id, input.monitorId),
      eq(legalSourceMonitors.version, input.expectedVersion),
    )).returning();
    if (!monitor) throw new ApiError(412, "Monitor changed", undefined, "PRECONDITION_FAILED");
    await syncLegalSourceMonitorJob(tx, {
      monitorId: monitor.id,
      active: monitor.active,
      runAfter: monitor.nextCheckAt,
      requestedByUserId: input.actorUserId,
    });
    await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_source_monitor.updated", entityType: "legal_source_monitor", entityId: monitor.id, requestId: input.requestId, metadata: { active: monitor.active, schedule: monitor.schedule, nextCheckAt: monitor.nextCheckAt.toISOString(), version: monitor.version } });
    return monitor;
  });
}
export async function listChangeAlerts(userId: string) { return (await listChangeAlertsPage({ userId, limit: 100 })).alerts; }
export async function listChangeAlertsPage(input: { userId: string; limit: number; cursor?: string }) { await requirePlatformCapability(input.userId, "corpus:read"); const scope = "corpus-change-alerts"; const cursor = input.cursor ? dateCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null; const rows = await db.query.legalSourceChangeAlerts.findMany({ where: cursor ? or(lt(legalSourceChangeAlerts.createdAt, new Date(cursor[0])), and(eq(legalSourceChangeAlerts.createdAt, new Date(cursor[0])), lt(legalSourceChangeAlerts.id, cursor[1]))) : undefined, orderBy: [desc(legalSourceChangeAlerts.createdAt), desc(legalSourceChangeAlerts.id)], limit: input.limit + 1 }); const page = rows.slice(0, input.limit); const last = page.at(-1); return { alerts: page, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined }; }
