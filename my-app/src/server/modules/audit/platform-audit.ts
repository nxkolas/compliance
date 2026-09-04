import { db } from "@/src/db";
import { platformAuditEvents } from "@/src/db/schema";

export type PlatformAuditInput = {
  operatorIdentity: string;
  eventType: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

export async function recordPlatformAuditEvent(input: PlatformAuditInput) {
  const [event] = await db.insert(platformAuditEvents).values({
    operatorIdentity: input.operatorIdentity,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    requestId: input.requestId,
    metadata: input.metadata ?? {},
  }).returning();
  return event;
}
