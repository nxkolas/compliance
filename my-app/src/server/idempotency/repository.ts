import { idempotencyRecords } from "@/src/db/schema";
import type { IdempotencyRecord, IdempotencyRepository } from "@/src/server/api/idempotency";
import { and, eq } from "drizzle-orm";

export const databaseIdempotencyRepository: IdempotencyRepository = {
  async create(record) {
    const { db } = await import("@/src/db");
    const inserted = await db
      .insert(idempotencyRecords)
      .values({
        actorKey: record.actorKey,
        scope: record.scope,
        operation: record.operation,
        key: record.key,
        requestFingerprint: record.requestFingerprint,
        state: record.state,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing()
      .returning({ id: idempotencyRecords.id });
    return inserted.length === 1;
  },

  async find(input) {
    const { db } = await import("@/src/db");
    const row = await db.query.idempotencyRecords.findFirst({
      where: claimWhere(input),
    });
    return row ? toRecord(row) : null;
  },

  async save(record) {
    const { db } = await import("@/src/db");
    await db
      .update(idempotencyRecords)
      .set({
        state: record.state,
        responseStatus: record.responseStatus,
        resultType: record.resultReference?.type,
        resultId: record.resultReference?.id,
        updatedAt: new Date(),
      })
      .where(claimWhere(record));
  },
};

function claimWhere(
  input: Pick<IdempotencyRecord, "actorKey" | "scope" | "operation" | "key">,
) {
  return and(
    eq(idempotencyRecords.actorKey, input.actorKey),
    eq(idempotencyRecords.scope, input.scope),
    eq(idempotencyRecords.operation, input.operation),
    eq(idempotencyRecords.key, input.key),
  );
}

function toRecord(row: typeof idempotencyRecords.$inferSelect): IdempotencyRecord {
  return {
    actorKey: row.actorKey,
    scope: row.scope,
    operation: row.operation,
    key: row.key,
    requestFingerprint: row.requestFingerprint,
    state: row.state,
    responseStatus: row.responseStatus ?? undefined,
    resultReference:
      row.resultType && row.resultId
        ? { type: row.resultType, id: row.resultId }
        : undefined,
  };
}
