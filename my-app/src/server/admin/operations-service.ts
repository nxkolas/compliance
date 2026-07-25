import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/src/db";
import { backgroundJobs, platformAuditEvents } from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { toJobDto } from "@/src/server/jobs";
import { getCursorCodec } from "@/src/server/api/pagination";

const cursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);

export async function listPlatformJobs(input: { userId: string; limit: number; cursor?: string; kind?: string; state?: string }) {
  await requirePlatformCapability(input.userId, "corpus:read");
  const scope = `platform-jobs:${JSON.stringify({ kind: input.kind ?? null, state: input.state ?? null })}`;
  const cursor = input.cursor ? cursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.backgroundJobs.findMany({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true },
    where: and(
      input.kind ? eq(backgroundJobs.kind, input.kind) : undefined,
      input.state ? eq(backgroundJobs.state, input.state as typeof backgroundJobs.$inferSelect.state) : undefined,
      cursor ? or(lt(backgroundJobs.createdAt, new Date(cursor[0])), and(eq(backgroundJobs.createdAt, new Date(cursor[0])), lt(backgroundJobs.id, cursor[1]))) : undefined,
    ),
    orderBy: [desc(backgroundJobs.createdAt), desc(backgroundJobs.id)],
    limit: input.limit + 1,
  });
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return { jobs: page.map(toJobDto), nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined };
}

export async function listPlatformAuditEvents(input: { userId: string; limit: number; cursor?: string; eventType?: string; entityType?: string; entityId?: string; actorUserId?: string; dateFrom?: Date; dateTo?: Date }) {
  await requirePlatformCapability(input.userId, "corpus:read");
  const filters = { eventType: input.eventType ?? null, entityType: input.entityType ?? null, entityId: input.entityId ?? null, actorUserId: input.actorUserId ?? null, dateFrom: input.dateFrom?.toISOString() ?? null, dateTo: input.dateTo?.toISOString() ?? null };
  const scope = `platform-audit:${JSON.stringify(filters)}`;
  const cursor = input.cursor ? cursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.platformAuditEvents.findMany({ columns: { id: true, actorUserId: true, eventType: true, entityType: true, entityId: true, requestId: true, metadata: true, createdAt: true },
    where: and(
      input.eventType ? eq(platformAuditEvents.eventType, input.eventType) : undefined,
      input.entityType ? eq(platformAuditEvents.entityType, input.entityType) : undefined,
      input.entityId ? eq(platformAuditEvents.entityId, input.entityId) : undefined,
      input.actorUserId ? eq(platformAuditEvents.actorUserId, input.actorUserId) : undefined,
      input.dateFrom ? gte(platformAuditEvents.createdAt, input.dateFrom) : undefined,
      input.dateTo ? lte(platformAuditEvents.createdAt, input.dateTo) : undefined,
      cursor ? or(lt(platformAuditEvents.createdAt, new Date(cursor[0])), and(eq(platformAuditEvents.createdAt, new Date(cursor[0])), lt(platformAuditEvents.id, cursor[1]))) : undefined,
    ),
    orderBy: [desc(platformAuditEvents.createdAt), desc(platformAuditEvents.id)],
    limit: input.limit + 1,
  });
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return { events: page.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })), nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined };
}
