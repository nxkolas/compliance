import { and, eq, gte, lt, lte, or } from "drizzle-orm";
import * as z from "zod";
import { authorizeOrganizationRead } from "@/src/server/auth/organization-scope";
import { getCursorCodec } from "@/src/server/api/pagination";

const cursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);
type AuditFilters = { eventType?: string; entityType?: string; entityId?: string; actorUserId?: string; dateFrom?: Date; dateTo?: Date };

export async function listOrganizationAuditEvents(input: { userId: string; organizationId: string; limit: number; cursor?: string } & AuditFilters) {
  const { executor: db } = await authorizeOrganizationRead({ actorUserId: input.userId, organizationId: input.organizationId, capability: "audit:read" });
  const scope = cursorScope(input.organizationId, input);
  const cursor = input.cursor ? cursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.auditEvents.findMany({
    where: { RAW: (table, operators) => and(
      eq(table.organizationId, input.organizationId),
      input.eventType ? eq(table.eventType, input.eventType) : undefined,
      input.entityType ? eq(table.entityType, input.entityType) : undefined,
      input.entityId ? eq(table.entityId, input.entityId) : undefined,
      input.actorUserId ? eq(table.actorUserId, input.actorUserId) : undefined,
      input.dateFrom ? gte(table.occurredAt, input.dateFrom) : undefined,
      input.dateTo ? lte(table.occurredAt, input.dateTo) : undefined,
      cursor ? or(lt(table.occurredAt, new Date(cursor[0])), and(eq(table.occurredAt, new Date(cursor[0])), lt(table.id, cursor[1]))) : undefined,
    ) ?? operators.sql`true` },
    orderBy: { occurredAt: "desc", id: "desc" },
    limit: input.limit + 1,
  });
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return {
    events: page.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
    nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.occurredAt.toISOString(), last.id]) : undefined,
  };
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
