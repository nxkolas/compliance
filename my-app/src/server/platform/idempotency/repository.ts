import { idempotencyRecords } from "@/src/db/schema";
import type {
  IdempotencyRecord,
  IdempotencyRepository,
  IdempotencyResultType,
} from "@/src/server/platform/http/idempotency";
import { and, eq } from "drizzle-orm";

type ResultLocator = { type: IdempotencyResultType; id: string };

export const databaseIdempotencyRepository: IdempotencyRepository = {
  async create(record) {
    const { db } = await import("@/src/db");
    const inserted = await db
      .insert(idempotencyRecords)
      .values({
        actorKey: record.actorKey,
        organizationId: record.organizationId,
        scope: record.scope,
        operation: record.operation,
        idempotencyKey: record.key,
        requestHash: record.requestFingerprint,
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
      where: {
        RAW: (table, operators) => claimWhere(table, input) ?? operators.sql`true`,
      },
    });
    if (!row) return null;
    return {
      actorKey: row.actorKey,
      organizationId: row.organizationId ?? undefined,
      scope: row.scope,
      operation: row.operation,
      key: row.idempotencyKey,
      requestFingerprint: row.requestHash,
      state: row.state,
      responseStatus: row.responseStatus ?? undefined,
      resultReference: parseResultLocator(row.resultLocator),
    };
  },

  async save(record) {
    const { db } = await import("@/src/db");
    await db
      .update(idempotencyRecords)
      .set({
        state: record.state,
        responseStatus: record.responseStatus,
        resultLocator: record.resultReference ?? null,
        updatedAt: new Date(),
      })
      .where(claimWhere(idempotencyRecords, record));
  },
};

function claimWhere(
  table: typeof idempotencyRecords,
  input: Pick<IdempotencyRecord, "actorKey" | "scope" | "operation" | "key">,
) {
  return and(
    eq(table.actorKey, input.actorKey),
    eq(table.scope, input.scope),
    eq(table.operation, input.operation),
    eq(table.idempotencyKey, input.key),
  );
}

function parseResultLocator(value: unknown): ResultLocator | undefined {
  if (!value || typeof value !== "object") return undefined;
  const locator = value as Partial<ResultLocator>;
  return typeof locator.type === "string" && typeof locator.id === "string"
    ? (locator as ResultLocator)
    : undefined;
}
