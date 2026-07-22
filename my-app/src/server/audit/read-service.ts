import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/src/db";
import { auditEvents } from "@/src/db/schema";
import { requireOrganizationCapability } from "@/src/server/auth/capability-service";
import { getCursorCodec } from "@/src/server/api/pagination";

const cursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);
type AuditFilters = { eventType?: string; entityType?: string; entityId?: string; actorUserId?: string; dateFrom?: Date; dateTo?: Date };
export async function listOrganizationAuditEvents(input: { userId: string; organizationId: string; limit: number; cursor?: string } & AuditFilters) {
  await requireOrganizationCapability(input.userId, input.organizationId, "audit:read");
  const scope = cursorScope(input.organizationId, input);
  const cursor = input.cursor ? cursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.auditEvents.findMany({
    where: and(
      eq(auditEvents.organizationId, input.organizationId),
      input.eventType ? eq(auditEvents.eventType, input.eventType) : undefined,
      input.entityType ? eq(auditEvents.entityType, input.entityType) : undefined,
      input.entityId ? eq(auditEvents.entityId, input.entityId) : undefined,
      input.actorUserId ? eq(auditEvents.actorUserId, input.actorUserId) : undefined,
      input.dateFrom ? gte(auditEvents.createdAt, input.dateFrom) : undefined,
      input.dateTo ? lte(auditEvents.createdAt, input.dateTo) : undefined,
      cursor ? or(lt(auditEvents.createdAt, new Date(cursor[0])), and(eq(auditEvents.createdAt, new Date(cursor[0])), lt(auditEvents.id, cursor[1]))) : undefined,
    ),
    orderBy: [desc(auditEvents.createdAt), desc(auditEvents.id)], limit: input.limit + 1,
  });
  const page = rows.slice(0, input.limit); const last = page.at(-1);
  return { events: page.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })), nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined };
}

function cursorScope(organizationId: string, filters: AuditFilters) {
  return `organization-audit:${organizationId}:${JSON.stringify({
    eventType: filters.eventType ?? null,
    entityType: filters.entityType ?? null,
    entityId: filters.entityId ?? null,
    actorUserId: filters.actorUserId ?? null,
    dateFrom: filters.dateFrom?.toISOString() ?? null,
    dateTo: filters.dateTo?.toISOString() ?? null,
  })}`;
}
